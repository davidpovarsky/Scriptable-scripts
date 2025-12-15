// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: gray; icon-glyph: magic;
// KavNavAPI

const Config = importModule('KavNavConfig');
const Helpers = importModule('KavNavHelpers');

// --- Location Logic ---
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

// --- Overpass Logic (Stops) ---
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

// --- KavNav Data Logic ---
module.exports.getStopData = async function(stopCode) {
  const today = new Date();
  const todayStr = Helpers.formatDate(today);

  const [summary, schedule, realtime] = await Promise.all([
    new Request(`${Config.BASE_URL}/stopSummary?stopCode=${stopCode}`).loadJSON().catch(() => null),
    new Request(`${Config.BASE_URL}/stopSchedule?stopCode=${stopCode}&date=${todayStr}`).loadJSON().catch(() => null),
    new Request(`${Config.BASE_URL}/realtime?stopCode=${stopCode}`).loadJSON().catch(() => null)
  ]);

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
      if (minutes < -5 || minutes > Config.LOOKAHEAD_MINUTES) return;
      
      const tripId = bus.trip.gtfsInfo?.tripId;
      if (tripId) realtimeTrips.add(tripId);

      trips.push({
        line: bus.trip.gtfsInfo?.routeNumber || routeMap[bus.trip.routeId] || "?",
        headsign: bus.trip.gtfsInfo?.headsign || "",
        minutes,
        realtime: true
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
};
