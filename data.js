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


// ===== פונקציות חדשות: תחנות קרובות + קווים פעילים בזמן אמת =====

// חישוב "מרחק" גס בין שתי נקודות (לא במטרים, אבל מספיק להשוואה)
function _distance2(lat1, lon1, lat2, lon2) {
  if (typeof lat1 !== "number" || typeof lon1 !== "number" ||
      typeof lat2 !== "number" || typeof lon2 !== "number") {
    return Infinity;
  }
  const dLat = lat1 - lat2;
  const dLon = lon1 - lon2;
  return dLat * dLat + dLon * dLon;
}

// החזרת N תחנות הקרובות למיקום (רק תחנות שיש להן stopCode)
module.exports.findNearestStops = async function(userLat, userLon, maxCount = 3) {
  const { byId, byCode } = await loadLocalStops();
  if (!byId || typeof byId.values !== "function") return [];

  const candidates = [];
  for (const s of byId.values()) {
    if (!s) continue;

    const code = s.stopCode != null ? String(s.stopCode) : "";
    const lat = typeof s.lat === "number" ? s.lat : Number(s.lat);
    const lon = typeof s.lon === "number" ? s.lon : Number(s.lon);
    if (!code || !isFinite(lat) || !isFinite(lon)) continue;

    const d2 = _distance2(userLat, userLon, lat, lon);
    candidates.push({
      stopId: s.stopId != null ? String(s.stopId) : "",
      stopCode: code,
      stopName: s.stopName || s.name || "",
      lat,
      lon,
      _d2: d2,
    });
  }

  candidates.sort((a, b) => a._d2 - b._d2);
  return candidates.slice(0, maxCount).map(({ _d2, ...rest }) => rest);
};

// מחזיר רשימת מסלולים (routeId בלבד) שיש להם זמן אמת בתחנות הנתונות
module.exports.fetchActiveRoutesForStops = async function(stopCodes) {
  const resultMap = new Map();
  const codesArr = Array.isArray(stopCodes) ? stopCodes : [];

  for (const rawCode of codesArr) {
    const code = rawCode != null ? String(rawCode) : "";
    if (!code) continue;

    try {
      const url = `${config.API_BASE}/realtime?stopCode=${encodeURIComponent(code)}`;
      const realtimeData = await utils.fetchJson(url);
      const vehicles = Array.isArray(realtimeData.vehicles) ? realtimeData.vehicles : [];

      for (const v of vehicles) {
        if (!v || !v.trip) continue;
        const routeIdRaw = v.trip.routeId;
        if (routeIdRaw == null) continue;

        const routeIdStr = String(routeIdRaw);
        if (resultMap.has(routeIdStr)) continue;

        const routeIdNum = Number(routeIdRaw);
        if (!Number.isFinite(routeIdNum)) continue;

        resultMap.set(routeIdStr, { routeId: routeIdNum });
      }
    } catch (e) {
      console.error(`Error fetching realtime for stop ${code}: ${e}`);
    }
  }

  return Array.from(resultMap.values());
};

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

    const operatorId = routeMeta?.agencyId ?? routeMeta?.operatorId ?? null;
    const operatorColor = config.getOperatorColor(operatorId, routeMeta?.color);

    const routeObj = {
      routeId,
      routeDate,
      routeMeta,
      routeCode: routeCodeStatic,
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

        const slimVehicles = vehiclesRaw.map((v) => {
            const trip = v.trip || {};
            const onwardCalls = trip.onwardCalls || {};
            const calls = Array.isArray(onwardCalls.calls) ? onwardCalls.calls : [];
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