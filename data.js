// data.js — גרסה מלאה, מתוקנת וללא שימוש ב-iCloud
// כל הפונקציות המקוריות נשמרו במלואן

const config = importModule("config");
const utils = importModule("utils");

// ------------------------------------------------------
// טעינת תחנות מהריפו — במקום loadLocalStops שהיה קורס
// ------------------------------------------------------

const STOPS_URL =
  "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/refs/heads/main/stops.json";

async function loadStopsFromRepo() {
  try {
    const stopsData = await utils.fetchJson(STOPS_URL);

    const stopsArray = Array.isArray(stopsData)
      ? stopsData
      : Array.isArray(stopsData.stops)
      ? stopsData.stops
      : [];

    const byId = new Map();
    const byCode = new Map();

    for (const s of stopsArray) {
      if (!s) continue;

      const id = String(s.stopId ?? "");
      const code = String(s.stopCode ?? "");
      if (id) byId.set(id, s);
      if (code) byCode.set(code, s);
    }

    return { byId, byCode };
  } catch (e) {
    console.error("Failed loading stops.json from repo:", e);
    return { byId: new Map(), byCode: new Map() };
  }
}

// ------------------------------------------------------
// פונקציות — תחנות קרובות
// ------------------------------------------------------

function _distance2(lat1, lon1, lat2, lon2) {
  if (
    !isFinite(lat1) ||
    !isFinite(lon1) ||
    !isFinite(lat2) ||
    !isFinite(lon2)
  ) {
    return Infinity;
  }
  const dx = lat1 - lat2;
  const dy = lon1 - lon2;
  return dx * dx + dy * dy;
}

module.exports.findNearestStops = async function (
  userLat,
  userLon,
  maxCount = 3
) {
  const { byId } = await loadStopsFromRepo();
  if (!byId || byId.size === 0) return [];

  const candidates = [];

  for (const s of byId.values()) {
    if (!s) continue;

    const lat = Number(s.lat);
    const lon = Number(s.lon);
    if (!isFinite(lat) || !isFinite(lon)) continue;

    const code = s.stopCode ? String(s.stopCode) : "";
    if (!code) continue;

    const d2 = _distance2(userLat, userLon, lat, lon);

    candidates.push({
      stopId: String(s.stopId ?? ""),
      stopCode: code,
      stopName: s.stopName || s.name || "",
      lat,
      lon,
      _d2: d2,
    });
  }

  candidates.sort((a, b) => a._d2 - b._d2);
  return candidates.slice(0, maxCount).map((x) => {
    delete x._d2;
    return x;
  });
};

// ------------------------------------------------------
// זמן אמת לפי תחנות — מחלץ routeId אמיתיים בלבד
// ------------------------------------------------------

module.exports.fetchActiveRoutesForStops = async function (stopCodes) {
  const resultMap = new Map();
  const codesArr = Array.isArray(stopCodes) ? stopCodes : [];

  for (const rawCode of codesArr) {
    const code = rawCode ? String(rawCode) : "";
    if (!code) continue;

    try {
      // שלב 1 — ניסיון זמן אמת
      const url = `${config.API_BASE}/realtime?stopCode=${encodeURIComponent(
        code
      )}`;
      const realtimeData = await utils.fetchJson(url);
      const vehicles = Array.isArray(realtimeData.vehicles)
        ? realtimeData.vehicles
        : [];

      for (const v of vehicles) {
        if (!v || !v.trip) continue;
        const rid = v.trip.routeId;
        if (!Number.isFinite(Number(rid))) continue;

        const key = String(rid);
        if (!resultMap.has(key)) resultMap.set(key, { routeId: Number(rid) });
      }

      if (resultMap.size > 0) continue;

      // שלב 2 — בדיקת תקינות תחנה
      const summaryUrl = `${config.API_BASE}/stopSummary?stopCode=${code}`;
      await utils.fetchJson(summaryUrl);

      // ⚠️ לא מוסיפים קווים — מציגים רק זמן אמת אמיתי

    } catch (e) {
      console.error(`Error fetching realtime for stop ${code}:`, e);
    }
  }

  return Array.from(resultMap.values());
};

// ------------------------------------------------------
// Shapes — מסלולי קווים
// ------------------------------------------------------

async function fetchShapeIdAndCoordsForRoute(routeInfo) {
  try {
    if (!routeInfo.shapeId) return;

    const url = `${config.API_BASE}/shapes?shapeIds=${encodeURIComponent(
      routeInfo.shapeId
    )}`;
    const shapesData = await utils.fetchJson(url);

    let coords = [];

    if (Array.isArray(shapesData[routeInfo.shapeId])) {
      coords = shapesData[routeInfo.shapeId];
    } else {
      const keys = Object.keys(shapesData);
      if (keys.length && Array.isArray(shapesData[keys[0]])) {
        coords = shapesData[keys[0]];
      }
    }

    if (coords.length > 0) {
      routeInfo.shapeCoords = coords;
    }
  } catch (e) {
    console.error("Error fetching shapes:", e);
  }
}

// ------------------------------------------------------
// מסלולים סטטיים — חלק קריטי למפה
// ------------------------------------------------------

module.exports.fetchStaticRoutes = async function (routesConfig, routeDate) {
  const { byId: stopsById } = await loadStopsFromRepo();
  const routesStatic = [];

  for (const cfg of routesConfig) {
    const routeId = cfg.routeId;
    const routeIdStr = String(routeId);

    let routeData;
    try {
      const url = `${config.API_BASE}/route?routeId=${encodeURIComponent(
        routeId
      )}&date=${encodeURIComponent(routeDate)}`;
      console.log("STATIC ROUTE URL:", url);
      routeData = await utils.fetchJson(url);
    } catch (e) {
      console.error(`Error fetching route ${routeId}:`, e);
      continue;
    }

    let routeMeta = null;
    if (Array.isArray(routeData.routes)) {
      routeMeta =
        routeData.routes.find((r) => String(r.routeId) === routeIdStr) ||
        routeData.routes[0] ||
        null;
    }

    const changes =
      (routeData.routeChanges &&
        routeData.routeChanges[routeIdStr]) ||
      [];

    const currentChange =
      changes.find((c) => c.isCurrent) || changes[0] || null;

    const rawStops = currentChange?.stoptimes || [];
    const headsign =
      currentChange?.headsign || routeMeta?.routeLongName || "";
    const shapeId = currentChange?.shapeId || null;

    const routeStops = rawStops
      .map((st) => {
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
      })
      .sort((a, b) => a.stopSequence - b.stopSequence);

    const operatorId =
      routeMeta?.agencyId ?? routeMeta?.operatorId ?? null;

    const operatorColor = config.getOperatorColor(
      operatorId,
      routeMeta?.color
    );

    routesStatic.push({
      routeId,
      routeDate,
      routeMeta,
      routeCode: routeMeta?.code ?? null,
      headsign,
      routeStops,
      routeDescExact: routeMeta?.routeDesc ?? null,
      routeDescPrefix: null,
      operatorId,
      operatorColor,
      shapeId,
      shapeCoords: null,
    });
  }

  // הבאת shapeCoords
  for (const r of routesStatic) {
    await fetchShapeIdAndCoordsForRoute(r);
  }

  return routesStatic;
};

// ------------------------------------------------------
// זמן אמת למסלולים — הצגה על המפה
// ------------------------------------------------------

module.exports.fetchRealtimeForRoutes = async function (routesStatic) {
  const allPayloads = [];

  for (const r of routesStatic) {
    try {
      const url = `${config.API_BASE}/realtime?routeCode=${encodeURIComponent(
        r.routeCode
      )}`;
      const realtimeData = await utils.fetchJson(url);

      const vehiclesRaw = Array.isArray(realtimeData.vehicles)
        ? realtimeData.vehicles
        : [];

      const vehicles = vehiclesRaw.map((v) => {
        const trip = v.trip || {};
        const calls = trip.onwardCalls?.calls || [];
        const gtfs = trip.gtfsInfo || {};
        const pos = v.geo?.positionOnLine?.positionOnLine ?? null;

        return {
          vehicleId: v.vehicleId,
          lastReported: v.lastReported,
          routeNumber: gtfs.routeNumber,
          headsign: gtfs.headsign,
          bearing: v.bearing || v.geo?.bearing || 0,
          positionOnLine: Number.isFinite(pos) ? pos : null,
          onwardCalls: calls.map((c) => ({
            stopCode: c.stopCode,
            eta: c.eta,
          })),
        };
      });

      allPayloads.push({
        meta: {
          routeId: r.routeId,
          routeCode: r.routeCode,
          routeDate: r.routeDate,
          operatorId: r.operatorId,
          operatorColor: r.operatorColor,
          headsign: r.headsign,
          routeLongName: r.routeMeta?.routeLongName ?? "",
          lastSnapshot: realtimeData.lastSnapshot,
          lastVehicleReport: realtimeData.lastVehicleReport,
        },
        stops: r.routeStops,
        vehicles,
        shapeCoords: r.shapeCoords,
      });
    } catch (e) {
      console.error("RT Error:", e);
    }
  }

  return allPayloads;
};