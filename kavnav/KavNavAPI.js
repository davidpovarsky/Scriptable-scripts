// KavNavAPI.js

const Config = importModule('KavNavConfig');
const Helpers = importModule('KavNavHelpers');

/* ===================== CACHE ===================== */

const _summaryCache = new Map();
const _scheduleCache = new Map();
// ✅ תוספת: שמירת נתוני זמן אמת אחרונים לגיבוי
const _realtimeCache = new Map(); 

function _isFresh(entry, ttlMs) {
  if (!entry) return false;
  return (Date.now() - entry.ts) < ttlMs;
}

async function _fetchJSON(url) {
  try {
    const req = new Request(url);
    req.timeoutInterval = 8; // טיימאוט קצר יחסית כדי לא לתקוע את הממשק
    return await req.loadJSON();
  } catch (e) {
    return null;
  }
}

async function _getStopSummaryCached(stopCode) {
  const key = String(stopCode);
  const entry = _summaryCache.get(key);
  if (_isFresh(entry, Config.SUMMARY_CACHE_TTL_MS)) return entry.data;

  const data = await _fetchJSON(`${Config.BASE_URL}/stopSummary?stopCode=${stopCode}`);
  if (data == null && entry) return entry.data; // גיבוי

  if (data) _summaryCache.set(key, { ts: Date.now(), data });
  return data || (entry ? entry.data : null);
}

async function _getStopScheduleCached(stopCode, dateStr) {
  const key = `${String(stopCode)}|${String(dateStr)}`;
  const entry = _scheduleCache.get(key);
  if (_isFresh(entry, Config.SCHEDULE_CACHE_TTL_MS)) return entry.data;

  const data = await _fetchJSON(`${Config.BASE_URL}/stopSchedule?stopCode=${stopCode}&date=${dateStr}`);
  if (data == null && entry) return entry.data; // גיבוי

  if (data) _scheduleCache.set(key, { ts: Date.now(), data });
  return data || (entry ? entry.data : null);
}

/* ===================== Location Logic (No Change) ===================== */

module.exports.getLocation = async function() {
  const p = args.shortcutParameter || {};
  const lat = parseFloat(p.lat || p.latitude);
  const lon = parseFloat(p.lon || p.longitude);

  if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };

  try {
    Location.setAccuracyToHundredMeters();
    const loc = await Location.current();
    return { lat: loc.latitude, lon: loc.longitude };
  } catch(e) {
    return null;
  }
};

/* ===================== Overpass Logic (No Change) ===================== */

module.exports.findNearbyStops = async function(lat, lon, currentStops = [], limit = Config.MAX_STATIONS, radius = Config.SEARCH_RADIUS) {
  const query = `[out:json][timeout:25];(node[highway=bus_stop](around:${radius},${lat},${lon});node[public_transport=platform](around:${radius},${lat},${lon}););out body;`;
  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  try {
    const data = await new Request(url).loadJSON();
    if (!data?.elements) return [];

    const existingCodes = new Set(currentStops.map(s => String(s.stopCode)));

    return data.elements
      .filter(el => el.tags && el.tags.ref)
      .map(el => ({
        name: el.tags?.name || el.tags?.["name:he"] || "תחנה",
        stopCode: String(el.tags.ref),
        distance: Math.round(Helpers.getDistance(lat, lon, el.lat, el.lon))
      }))
      .filter(s => !existingCodes.has(s.stopCode))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  } catch (e) {
    return [];
  }
};

/* ===================== KavNav Data Logic ===================== */

module.exports.getStopData = async function(stopCode) {
  const today = new Date();
  const todayStr = Helpers.formatDate(today);

  // 1. נסיון שליפת נתונים מהרשת
  let [summary, schedule, realtime] = await Promise.all([
    _getStopSummaryCached(stopCode),
    _getStopScheduleCached(stopCode, todayStr),
    _fetchJSON(`${Config.BASE_URL}/realtime?stopCode=${stopCode}`)
  ]);

  // ✅ לוגיקה חדשה: טיפול בכישלון רשת ושימוש במידע ישן (סימולציה)
  let isRealtimeStale = false;

  if (realtime) {
    // אם הצלחנו להביא נתונים - נשמור בגיבוי
    _realtimeCache.set(String(stopCode), realtime);
  } else {
    // אם נכשלנו - נבדוק אם יש גיבוי
    const cachedRealtime = _realtimeCache.get(String(stopCode));
    if (cachedRealtime) {
      realtime = cachedRealtime;
      isRealtimeStale = true; // סימון שהמידע לא טרי
    }
  }

  // מכאן והלאה הלוגיקה זהה, אבל החישוב של הדקות (Helpers.getMinutesDiff)
  // מתבצע מול today (שהוא עכשיו), לכן הזמנים יתעדכנו גם אם המידע מהגיבוי!

  let fetchedName = null;
  if (Array.isArray(summary) && summary.length > 0) fetchedName = summary[0].name;
  else if (summary && summary.name) fetchedName = summary.name;

  const routeMap = {};
  (Array.isArray(summary) ? summary : [summary]).forEach(g => {
    g?.routes?.forEach(r => routeMap[r.routeId] = r.routeNumber);
  });

  const trips = [];
  const realtimeTrips = new Set();

  if (realtime?.vehicles) {
    realtime.vehicles.forEach(bus => {
      const call = bus.trip?.onwardCalls?.calls?.find(c => String(c.stopCode) === String(stopCode));
      if (!call) return;
      
      const eta = new Date(call.eta);
      // ✅ חישוב דינמי: גם אם המידע ישן, ההפרש יחושב מול עכשיו
      const minutes = Helpers.getMinutesDiff(eta);
      
      // סינון קווים שכבר עברו מזמן
      if (minutes < -5 || minutes > Config.LOOKAHEAD_MINUTES) return;

      const tripId = bus.trip.gtfsInfo?.tripId;
      if (tripId) realtimeTrips.add(tripId);

      trips.push({
        line: bus.trip.gtfsInfo?.routeNumber || routeMap[bus.trip.routeId] || "?",
        headsign: bus.trip.gtfsInfo?.headsign || "",
        minutes,
        realtime: true,
        stale: isRealtimeStale // ✅ דגל חדש ל-UI לצביעה בכתום
      });
    });
  }

  if (schedule?.stopSchedule) {
    const list = Array.isArray(schedule.stopSchedule) ? schedule.stopSchedule : [schedule.stopSchedule];
    list.forEach(s => {
      s.trips?.forEach(t => {
        if (realtimeTrips.has(t.tripId)) return;
        
        const dep = Helpers.parseTimeStr(t.departureTime, today);
        // ✅ גם כאן החישוב דינמי מול השעה הנוכחית
        const minutes = Helpers.getMinutesDiff(dep);
        
        if (minutes < 0 || minutes > Config.LOOKAHEAD_MINUTES) return;
        trips.push({
          line: routeMap[t.routeId] || t.routeId,
          headsign: t.headsign,
          minutes,
          realtime: false
          // בלו"ז מתוכנן אין משמעות ל-stale, הוא תמיד סטטי
        });
      });
    });
  }

  const grouped = {};
  trips.forEach(t => {
    const k = t.line + "_" + t.headsign;
    grouped[k] ??= { line: t.line, headsign: t.headsign, arrivals: [] };
    grouped[k].arrivals.push(t);
  });

  return {
    stopCode,
    name: fetchedName,
    groups: Object.values(grouped).map(g => ({
      line: g.line,
      headsign: g.headsign,
      arrivals: g.arrivals.sort((a, b) => a.minutes - b.minutes).slice(0, 4)
    }))
  };
};
