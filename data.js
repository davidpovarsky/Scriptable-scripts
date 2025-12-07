// data.js
// אחראי על כל התקשורת מול השרת ועיבוד הנתונים
const config = importModule('config');
const utils = importModule('utils');

// טעינת תחנות מקומיות
async function loadLocalStops() {
  const fm = FileManager.iCloud();
  const stopsFile = fm.joinPath(fm.documentsDirectory(), "stops.json");
  // נסיון להוריד אם לא קיים או לעדכן
  try {
      await fm.downloadFileFromiCloud(stopsFile);
  } catch(e) {}
  
  if (!fm.fileExists(stopsFile)) return { byId: new Map(), byCode: new Map() };

  const stopsDataRaw = fm.readString(stopsFile);
  let stopsData;
  try {
    stopsData = JSON.parse(stopsDataRaw);
  } catch (e) {
    console.error("Error parsing stops.json");
    return { byId: new Map(), byCode: new Map() };
  }

  const stopsArray = Array.isArray(stopsData) ? stopsData : (Array.isArray(stopsData.stops) ? stopsData.stops : []);
  const stopsById = new Map();
  const stopsByCode = new Map();
  for (const s of stopsArray) {
    if (!s) continue;
    const id = String(s.stopId ?? "");
    const code = String(s.stopCode ?? "");
    if (id) stopsById.set(id, s);
    if (code) stopsByCode.set(code, s);
  }
  return { byId: stopsById, byCode: stopsByCode };
}

// הבאת נתוני Shape
async function fetchShapeIdAndCoordsForRoute(routeInfo) {
  try {
    if (!routeInfo.shapeId || typeof routeInfo.shapeId !== "string") return;
    const shapeId = routeInfo.shapeId;
    const shapesUrl = `${config.API_BASE}/shapes?shapeIds=${encodeURIComponent(shapeId)}`;
    const shapesData = await utils.fetchJson(shapesUrl);

    let coords = [];
    if (shapesData && typeof shapesData === "object") {
      if (Array.isArray(shapesData[shapeId])) {
        coords = shapesData[shapeId];
      } else {
        const keys = Object.keys(shapesData);
        if (keys.length && Array.isArray(shapesData[keys[0]])) coords = shapesData[keys[0]];
      }
    }
    if (coords.length) routeInfo.shapeCoords = coords;
  } catch (e) {
    console.error(`Error fetching shapes: ${e}`);
  }
}

// הפונקציה הראשית שטוענת את כל המסלולים הסטטיים
module.exports.fetchStaticRoutes = async function(routesConfig, routeDate) {
  const { byId: stopsById } = await loadLocalStops();
  const routesStatic = [];

  for (const cfg of routesConfig) {
    const routeId = cfg.routeId;
    const routeIdStr = String(routeId);
    let routeData;
    
    try {
      const url = `${config.API_BASE}/route?routeId=${encodeURIComponent(routeId)}&date=${encodeURIComponent(routeDate)}`;
      routeData = await utils.fetchJson(url);
    } catch (e) {
      console.error(`Error fetching route ${routeId}: ${e}`);
      continue;
    }

    let routeMeta = null;
    if (Array.isArray(routeData.routes)) {
      routeMeta = routeData.routes.find((r) => String(r.routeId) === routeIdStr) || routeData.routes[0] || null;
    }

    const routeChangesForRoute = (routeData.routeChanges && routeData.routeChanges[routeIdStr]) || [];
    let currentChange = routeChangesForRoute.find((c) => c.isCurrent) || routeChangesForRoute[0] || null;

    const rawStoptimes = currentChange?.stoptimes || [];
    const headsign = currentChange?.headsign || routeMeta?.routeLongName || "";
    const shapeIdFromRoute = currentChange?.shapeId || null;
    
    const routeCodeStatic = routeMeta?.code || null;
    const routeDirection = routeMeta?.direction || null;
    const routeDescExact = routeMeta?.routeDesc || null;
    const routeDescPrefix = (routeCodeStatic && routeDirection) ? `${routeCodeStatic}-${routeDirection}-` : null;

    const routeStops = rawStoptimes.map((st) => {
      const sid = String(st.stopId ?? "");
      const base = stopsById.get(sid) || {};
      return {
        stopId: sid,
        stopSequence: st.stopSequence,
        pickup: !!st.pickup,
        dropoff: !!st.dropoff,
        stopCode: base.stopCode ?? null,
        stopName: base.stopName ?? "(ללא שם)",
        lat: base.lat ?? null,
        lon: base.lon ?? null,
      };
    }).sort((a, b) => (a.stopSequence || 0) - (b.stopSequence || 0));

    const operatorId = routeMeta?.operatorId ?? null;
    const apiColor = routeMeta?.color ?? null;
    const operatorColor = config.getOperatorColor(operatorId, apiColor);

    const routeObj = {
      routeId,
      routeCode: routeCodeStatic,
      routeDate,
      routeMeta,
      headsign,
      routeStops,
      routeDescExact,
      routeDescPrefix,
      operatorId,
      operatorColor,
      shapeId: shapeIdFromRoute,
      shapeCoords: null,
    };
    
    routesStatic.push(routeObj);
  }

  // השלמת shapes
  for (const r of routesStatic) {
    await fetchShapeIdAndCoordsForRoute(r);
  }

  return routesStatic;
};

// פונקציה להבאת נתוני זמן אמת
module.exports.fetchRealtimeForRoutes = async function(routesStatic) {
  const allPayloads = [];

  for (const r of routesStatic) {
    try {
        const realtimeUrl = `${config.API_BASE}/realtime?routeCode=${encodeURIComponent(r.routeCode)}`;
        const realtimeData = await utils.fetchJson(realtimeUrl);

        const vehiclesRaw = Array.isArray(realtimeData.vehicles) ? realtimeData.vehicles : [];
        
        const vehiclesFiltered = vehiclesRaw.filter((v) => {
            const gtfs = v.trip?.gtfsInfo || {};
            const rd = gtfs.routeDesc || "";
            if (!rd) return false;
            if (r.routeDescExact && rd === r.routeDescExact) return true;
            if (r.routeDescPrefix && rd.startsWith(r.routeDescPrefix)) return true;
            return false;
        });

        const slimVehicles = vehiclesFiltered.map((v) => {
            const trip = v.trip || {};
            const onward = trip.onwardCalls || {};
            const calls = Array.isArray(onward.calls) ? onward.calls : [];
            const gtfs = trip.gtfsInfo || {};
            const pos = v.geo?.positionOnLine?.positionOnLine ?? null;

            return {
            vehicleId: v.vehicleId,
            lastReported: v.lastReported,
            routeNumber: gtfs.routeNumber,
            headsign: gtfs.headsign,
            positionOnLine: typeof pos === "number" ? pos : null,
            onwardCalls: calls.map((c) => ({ stopCode: c.stopCode, eta: c.eta })),
            };
        });

        allPayloads.push({
            meta: {
            routeId: r.routeId,
            routeCode: r.routeCode,
            routeDate: r.routeDate,
            routeNumber: r.routeMeta?.routeNumber ?? "",
            routeLongName: r.routeMeta?.routeLongName ?? "",
            headsign: r.headsign,
            lastSnapshot: realtimeData.lastSnapshot,
            lastVehicleReport: realtimeData.lastVehicleReport,
            operatorId: r.operatorId,
            operatorColor: r.operatorColor,
            },
            stops: r.routeStops,
            vehicles: slimVehicles,
            shapeCoords: r.shapeCoords || null,
        });
    } catch(e) { console.error("RT Error: " + e); }
  }
  return allPayloads;
};
