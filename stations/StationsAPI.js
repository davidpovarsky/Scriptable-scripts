// stations/StationsAPI.js
// API לטיפול בתחנות ונתוני זמן אמת

const config = importModule('config');
const utils = importModule('utils');

// ===== CACHE =====
const _summaryCache = new Map();
const _scheduleCache = new Map();
const _realtimeCache = new Map();

function _isFresh(entry, ttlMs) {
  if (!entry) return false;
  return (Date.now() - entry.ts) < ttlMs;
}

// ===== קבלת סיכום תחנה (עם Cache) =====
async function _getStopSummaryCached(stopCode) {
  const key = String(stopCode);
  const entry = _summaryCache.get(key);
  if (_isFresh(entry, config.SUMMARY_CACHE_TTL_MS)) return entry.data;

  const data = await utils.fetchJson(`${config.API_BASE}/stopSummary?stopCode=${stopCode}`);
  if (data == null && entry) return entry.data;

  if (data) _summaryCache.set(key, { ts: Date.now(), data });
  return data || (entry ? entry.data : null);
}

// ===== קבלת לוח זמנים (עם Cache) =====
async function _getStopScheduleCached(stopCode, dateStr) {
  const key = `${String(stopCode)}|${String(dateStr)}`;
  const entry = _scheduleCache.get(key);
  if (_isFresh(entry, config.SCHEDULE_CACHE_TTL_MS)) return entry.data;

  const data = await utils.fetchJson(`${config.API_BASE}/stopSchedule?stopCode=${stopCode}&date=${dateStr}`);
  if (data == null && entry) return entry.data;

  if (data) _scheduleCache.set(key, { ts: Date.now(), data });
  return data || (entry ? entry.data : null);
}

// ===== חיפוש תחנות קרובות ב-Overpass =====
module.exports.findNearbyStops = async function(lat, lon, currentStops = [], limit = config.MAX_STATIONS, radius = config.SEARCH_RADIUS) {
  const query = `[out:json][timeout:25];(node[highway=bus_stop](around:${radius},${lat},${lon});node[public_transport=platform](around:${radius},${lat},${lon}););out body;`;
  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  try {
    const data = await utils.fetchJson(url);
    if (!data?.elements) return [];

    const existingCodes = new Set(currentStops.map(s => String(s.stopCode)));

    return data.elements
      .filter(el => el.tags && el.tags.ref)
      .map(el => ({
        name: el.tags?.name || el.tags?.["name:he"] || "תחנה",
        stopCode: String(el.tags.ref),
        distance: Math.round(utils.getDistance(lat, lon, el.lat, el.lon)),
        lat: el.lat,
        lon: el.lon
      }))
      .filter(s => !existingCodes.has(s.stopCode))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  } catch (e) {
    console.error('Overpass error:', e);
    return [];
  }
};

// ===== קבלת נתוני תחנה מלאים =====
module.exports.getStopData = async function(stopCode) {
  const today = new Date();
  const todayStr = utils.formatDate(today);

  let [summary, schedule, realtime] = await Promise.all([
    _getStopSummaryCached(stopCode),
    _getStopScheduleCached(stopCode, todayStr),
    utils.fetchJson(`${config.API_BASE}/realtime?stopCode=${stopCode}`)
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
    g?.routes?.forEach(r => routeMap[r.routeId] = { 
      routeNumber: r.routeNumber,
      routeId: r.routeId
    });
  });

  const trips = [];
  const realtimeTrips = new Set();

  if (realtime?.vehicles) {
    realtime.vehicles.forEach(bus => {
      const call = bus.trip?.onwardCalls?.calls?.find(c => String(c.stopCode) === String(stopCode));
      if (!call) return;
      
      const eta = new Date(call.eta);
      const minutes = utils.getMinutesDiff(eta);
      
      if (minutes < -0 || minutes > config.LOOKAHEAD_MINUTES) return;

      const tripId = bus.trip.gtfsInfo?.tripId;
      if (tripId) realtimeTrips.add(tripId);

      trips.push({
        line: bus.trip.gtfsInfo?.routeNumber || routeMap[bus.trip.routeId]?.routeNumber || "?",
        routeId: bus.trip.routeId,
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
        
        const dep = utils.parseTimeStr(t.departureTime, today);
        const minutes = utils.getMinutesDiff(dep);
        
        if (minutes < 0 || minutes > config.LOOKAHEAD_MINUTES) return;
        trips.push({
          line: routeMap[t.routeId]?.routeNumber || t.routeId,
          routeId: t.routeId,
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
    grouped[k] ??= { 
      line: t.line, 
      routeId: t.routeId,
      headsign: t.headsign, 
      arrivals: [] 
    };
    grouped[k].arrivals.push(t);
  });

  return {
    stopCode,
    name: fetchedName,
    groups: Object.values(grouped).map(g => ({
      line: g.line,
      routeId: g.routeId,
      headsign: g.headsign,
      arrivals: g.arrivals.sort((a, b) => a.minutes - b.minutes).slice(0, 4)
    }))
  };
};