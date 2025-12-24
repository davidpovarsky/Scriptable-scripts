// KavNavAPI.js - לוגיקת נתונים משותפת ל-Scriptable ודפדפן

// ===============================
// זיהוי סביבה וטעינת תלויות
// ===============================
var IS_SCRIPTABLE = typeof window !== 'undefined' ? window.IS_SCRIPTABLE : (typeof FileManager !== 'undefined');
var IS_BROWSER = typeof window !== 'undefined' ? window.IS_BROWSER : false;

var Config, Helpers, Search;

if (IS_SCRIPTABLE) {
  Config = importModule('kavnav/KavNavConfig');
  Helpers = importModule('kavnav/KavNavHelpers');
  Search = importModule('kavnav/KavNavSearch');
} else {
  if (typeof window.KavNavConfig !== 'undefined') {
    Config = window.KavNavConfig;
    Helpers = window.KavNavHelpers;
    Search = window.KavNavSearch;
  }
}

// ===============================
// פונקציית עזר ל-Fetch עם תמיכה ב-PROXY
// ===============================
async function fetchJSON(url) {
  const finalUrl = Config.PROXY_URL ? Config.PROXY_URL + encodeURIComponent(url) : url;

  // ===== Scriptable =====
  if (IS_SCRIPTABLE) {
    const req = new Request(finalUrl);
    req.headers = {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile Safari/604.1"
    };
    req.timeoutInterval = 15;

    try {
      const text = await req.loadString();
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        console.error("Fetch error: invalid JSON", finalUrl, text.slice(0, 200));
        throw parseErr;
      }
    } catch (e) {
      console.error("Fetch error:", (e && e.message) ? e.message : e, finalUrl);
      throw e;
    }
  }

  // ===== Browser =====
  try {
    const r = await fetch(finalUrl, { headers: { "Accept": "application/json" } });
    const text = await r.text();

    if (!r.ok) {
      console.error("Fetch error:", r.status, r.statusText, finalUrl, text.slice(0, 200));
      throw new Error(`HTTP ${r.status}`);
    }

    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.error("Fetch error: invalid JSON", finalUrl, text.slice(0, 200));
      throw parseErr;
    }
  } catch (e) {
    console.error("Fetch error:", (e && e.message) ? e.message : e, finalUrl);
    throw e;
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
// Nearby Stops (stops.json) במקום Overpass
// ===============================
async function findNearbyStops(lat, lon, currentStops = [], limit = Config.MAX_STATIONS, radius = Config.SEARCH_RADIUS) {
  try {
    const stops = (Search && typeof Search.loadStopsData === 'function') ? await Search.loadStopsData() : [];
    if (!Array.isArray(stops) || stops.length === 0) return [];

    const existingCodes = new Set(currentStops.map(s => String(s.stopCode)));

    const lat0 = Number(lat);
    const lon0 = Number(lon);
    const r = Number(radius) || 0;
    const lim = Number(limit) || 0;
    if (!isFinite(lat0) || !isFinite(lon0) || r <= 0 || lim <= 0) return [];

    // סינון מהיר בקופסת גבולות לפני חישוב מרחק מלא
    const metersPerDegLat = 111320;
    const degLat = r / metersPerDegLat;
    const cosLat = Math.cos(lat0 * Math.PI / 180) || 1e-6;
    const degLon = r / (metersPerDegLat * cosLat);

    const out = [];

    for (const st of stops) {
      if (!st) continue;

      const code = st.stopCode;
      if (code == null) continue;

      const codeStr = String(code);
      if (existingCodes.has(codeStr)) continue;

      const sLat = Number(st.lat);
      const sLon = Number(st.lon);
      if (!isFinite(sLat) || !isFinite(sLon)) continue;

      // bounding box quick reject
      if (Math.abs(sLat - lat0) > degLat) continue;
      if (Math.abs(sLon - lon0) > degLon) continue;

      const dist = Math.round(Helpers.getDistance(lat0, lon0, sLat, sLon));
      if (dist > r) continue;

      out.push({
        name: st.stopName || st.name || "תחנה",
        stopCode: codeStr,
        distance: dist
      });
    }

    out.sort((a, b) => a.distance - b.distance);
    return out.slice(0, lim);
  } catch (e) {
    console.error('Nearby stops (stops.json) error:', e);
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

  // ✅ תיקון: buses במקום vehicles!
  if (realtime?.buses) {
    realtime.buses.forEach(bus => {
      const dep = new Date(bus.expectedArrivalTime || bus.expectedDepartureTime || bus.plannedArrivalTime || bus.plannedDepartureTime);
      const minutes = Helpers.getMinutesDiff(dep);
      if (minutes < 0 || minutes > Config.LOOKAHEAD_MINUTES) return;

      if (bus.trip?.tripId) realtimeTrips.add(bus.trip.tripId);

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