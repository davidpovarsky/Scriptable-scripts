// KavNavAPI.js - לוגיקת נתונים משותפת ל-Scriptable ודפדפן

// ===============================
// זיהוי סביבה וטעינת תלויות
// ===============================
var IS_SCRIPTABLE = typeof window !== 'undefined' ? window.IS_SCRIPTABLE : (typeof FileManager !== 'undefined');
var IS_BROWSER = typeof window !== 'undefined' ? window.IS_BROWSER : false;

var Config, Helpers;

if (IS_SCRIPTABLE) {
  Config = importModule('kavnav/KavNavConfig');
  Helpers = importModule('kavnav/KavNavHelpers');
} else {
  // בדפדפן - השתמש ישירות מ-window (ללא הגדרה מחדש)
  if (typeof window.KavNavConfig !== 'undefined') {
    Config = window.KavNavConfig;
    Helpers = window.KavNavHelpers;
  }
}

// ===============================
// פונקציית עזר ל-Fetch עם תמיכה ב-PROXY
// ===============================
function buildUrl(originalUrl) {
  if (IS_BROWSER) {
    // בדפדפן - בדוק אם זה local או GitHub Pages
    const isLocal = window.location.protocol === 'file:' || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
    
    if (isLocal) {
      // Local - השתמש ב-PROXY
      return Config.PROXY_URL + encodeURIComponent(originalUrl);
    }
  }
  // Scriptable או GitHub Pages - URL ישיר
  return originalUrl;
}

async function fetchJSON(url) {
  try {
    const finalUrl = buildUrl(url);
    
    if (IS_SCRIPTABLE) {
      const req = new Request(finalUrl);
      req.timeoutInterval = 8;
      return await req.loadJSON();
    } else {
      const response = await fetch(finalUrl);
      if (!response.ok) return null;
      return await response.json();
    }
  } catch (e) {
    console.error('Fetch error:', e);
    return null;
  }
}

// ===============================
// CACHE
// ===============================
const _summaryCache = new Map();
const _scheduleCache = new Map();
const _realtimeCache = new Map();

function _isFresh(entry, ttlMs) {
  if (!entry) return false;
  return (Date.now() - entry.ts) < ttlMs;
}

async function _getStopSummaryCached(stopCode) {
  const key = String(stopCode);
  const entry = _summaryCache.get(key);
  if (_isFresh(entry, Config.SUMMARY_CACHE_TTL_MS)) return entry.data;

  const data = await fetchJSON(`${Config.BASE_URL}/stopSummary?stopCode=${stopCode}`);
  if (data == null && entry) return entry.data;

  if (data) _summaryCache.set(key, { ts: Date.now(), data });
  return data || (entry ? entry.data : null);
}

async function _getStopScheduleCached(stopCode, dateStr) {
  const key = `${String(stopCode)}|${String(dateStr)}`;
  const entry = _scheduleCache.get(key);
  if (_isFresh(entry, Config.SCHEDULE_CACHE_TTL_MS)) return entry.data;

  const data = await fetchJSON(`${Config.BASE_URL}/stopSchedule?stopCode=${stopCode}&date=${dateStr}`);
  if (data == null && entry) return entry.data;

  if (data) _scheduleCache.set(key, { ts: Date.now(), data });
  return data || (entry ? entry.data : null);
}

// ===============================
// Location Logic
// ===============================
async function getLocation() {
  if (IS_SCRIPTABLE) {
    // Scriptable - נסה לקבל מפרמטרים או מ-GPS
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
  } else {
    // Browser - השתמש ב-Geolocation API
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  }
}

// ===============================
// Overpass Logic
// ===============================
async function findNearbyStops(lat, lon, currentStops = [], limit = Config.MAX_STATIONS, radius = Config.SEARCH_RADIUS) {
  const query = `[out:json][timeout:25];(node[highway=bus_stop](around:${radius},${lat},${lon});node[public_transport=platform](around:${radius},${lat},${lon}););out body;`;
  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  try {
    const data = await fetchJSON(url);
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
    console.error('Overpass error:', e);
    return [];
  }
}

// ===============================
// KavNav Data Logic
// ===============================
async function getStopData(stopCode) {
  const today = new Date();
  const todayStr = Helpers.formatDate(today);

  let [summary, schedule, realtime] = await Promise.all([
    _getStopSummaryCached(stopCode),
    _getStopScheduleCached(stopCode, todayStr),
    fetchJSON(`${Config.BASE_URL}/realtime?stopCode=${stopCode}`)
  ]);

  let isRealtimeStale = false;

  if (realtime) {
    _realtimeCache.set(String(stopCode), realtime);
  } else {
    const cachedRealtime = _realtimeCache.get(String(stopCode));
    if (cachedRealtime) {
      realtime = cachedRealtime;
      isRealtimeStale = true;
    }
  }

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
      const minutes = Helpers.getMinutesDiff(eta);
      
      if (minutes < -0 || minutes > Config.LOOKAHEAD_MINUTES) return;

      const tripId = bus.trip.gtfsInfo?.tripId;
      if (tripId) realtimeTrips.add(tripId);

      trips.push({
        line: bus.trip.gtfsInfo?.routeNumber || routeMap[bus.trip.routeId] || "?",
        headsign: bus.trip.gtfsInfo?.headsign || "",
        minutes,
        realtime: true,
        stale: isRealtimeStale
      });
    });
  }

  if (schedule?.stopSchedule) {
    const list = Array.isArray(schedule.stopSchedule) ? schedule.stopSchedule : [schedule.stopSchedule];
    list.forEach(s => {
      s.trips?.forEach(t => {
        if (realtimeTrips.has(t.tripId)) return;
        
        const dep = Helpers.parseTimeStr(t.departureTime, today);
        const minutes = Helpers.getMinutesDiff(dep);
        
        if (minutes < 0 || minutes > Config.LOOKAHEAD_MINUTES) return;
        trips.push({
          line: routeMap[t.routeId] || t.routeId,
          headsign: t.headsign,
          minutes,
          realtime: false
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
}

// ===============================
// Export לפי סביבה
// ===============================
var API = {
  getLocation,
  findNearbyStops,
  getStopData
};

if (IS_SCRIPTABLE) {
  module.exports = API;
} else {
  window.KavNavAPI = API;
}
