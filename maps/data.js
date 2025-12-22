// data.js
// אחראי על כל התקשורת מול השרת ועיבוד הנתונים
const config = importModule('config');
const utils = importModule('utils');

// טעינת תחנות מקומיות
async function loadLocalStops() {
  const fm = FileManager.iCloud();
  const stopsFile = fm.joinPath(fm.documentsDirectory(), "stops.json");

  try { await fm.downloadFileFromiCloud(stopsFile); } catch(e) {}

  if (!fm.fileExists(stopsFile)) return { byId: new Map(), byCode: new Map() };

  const stopsDataRaw = fm.readString(stopsFile);
  let stopsData;

  try {
    stopsData = JSON.parse(stopsDataRaw);
  } catch (e) {
    return { byId: new Map(), byCode: new Map() };
  }

  const stopsArray = Array.isArray(stopsData) ? stopsData : (stopsData?.stops || []);
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

// טעינת מסלולים מקומיים
async function loadLocalRoutes() {
  const fm = FileManager.iCloud();
  const routesFile = fm.joinPath(fm.documentsDirectory(), "routes.json");

  try { await fm.downloadFileFromiCloud(routesFile); } catch(e) {}

  if (!fm.fileExists(routesFile)) return [];

  const raw = fm.readString(routesFile);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed?.routes || []);
  } catch (e) {
    return [];
  }
}

// --- פונקציה לקבלת תחנות קרובות ---
module.exports.findNearestStops = async function(lat, lon) {
  const url = `${config.API_BASE}/nearestStops?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const res = await utils.fetchJson(url);
  const stops = Array.isArray(res?.stops) ? res.stops : [];

  // נוודא מבנה מינימלי
  return stops.map(s => ({
    stopCode: s.stopCode ?? s.code ?? s.stop_code ?? s.stop ?? s.stopId ?? null,
    stopId: s.stopId ?? s.id ?? null,
    stopName: s.stopName ?? s.name ?? "",
    distance: s.distance ?? null,
    lat: s.lat ?? null,
    lon: s.lon ?? null
  })).filter(s => s.stopCode);
};

// --- בניית routesStatic לפי קווים פעילים בקרבת משתמש ---
module.exports.buildRoutesStaticFromNearbyStops = async function(nearestStops) {
  const { byCode } = await loadLocalStops();
  const localRoutes = await loadLocalRoutes();

  // אוספים routeIds פעילים מה־realtime של התחנות הקרובות
  const routeIdSet = new Set();

  for (const stop of nearestStops) {
    const stopCode = stop.stopCode;
    if (!stopCode) continue;

    try {
      const url = `${config.API_BASE}/realtime?stopCode=${encodeURIComponent(stopCode)}`;
      const realtime = await utils.fetchJson(url);
      const vehicles = Array.isArray(realtime?.vehicles) ? realtime.vehicles : [];

      vehicles.forEach(v => {
        const rid = v?.trip?.routeId;
        if (rid != null) routeIdSet.add(String(rid));
      });
    } catch (e) {}
  }

  // בונים routesStatic מפורט: routeId + routeCode + routeNumber + headsign + stops
  const routesStatic = [];

  for (const routeId of routeIdSet) {
    // התאמה לרשימת routes.json המקומית (אם קיימת)
    const gtfs = localRoutes.find(r => String(r.routeId) === String(routeId));
    const routeCode = gtfs?.routeCode ?? gtfs?.routeShortName ?? routeId;
    const routeNumber = gtfs?.routeNumber ?? gtfs?.shortName ?? gtfs?.routeShortName ?? routeCode;
    const headsign = gtfs?.headsign ?? gtfs?.routeLongName ?? "";

    // ניסוי להביא רשימת תחנות למסלול (אם יש)
    let routeStops = [];
    if (Array.isArray(gtfs?.stops) && gtfs.stops.length) {
      routeStops = gtfs.stops.map(st => {
        const stopId = st.stopId ?? st.id ?? null;
        const base = stopId != null ? byCode.get(String(st.stopCode ?? "")) : null;

        return {
          stopId,
          stopCode: st.stopCode ?? base?.stopCode ?? null,
          stopName: st.stopName ?? base?.stopName ?? st.name ?? "",
          lat: st.lat ?? base?.lat ?? null,
          lon: st.lon ?? base?.lon ?? null
        };
      }).filter(s => s.stopCode || s.stopId);
    }

    routesStatic.push({
      routeId,
      routeCode,
      routeNumber,
      headsign,
      stops: routeStops
    });
  }

  return routesStatic;
};

// --- זמן אמת “מהתחנות” -> יוצר payload לפי routes (כדי לשמור על ארכיטקטורת הפרויקט) ---
module.exports.fetchRealtimeForRoutesFromStops = async function(routesStatic, nearestStops) {

  // 🔹 שלב 1: בניית מפה של routeId ← routeStatic
  const routeMap = new Map();
  routesStatic.forEach(r => {
    routeMap.set(String(r.routeId), r);
  });

  // 🧩 מפת stopId -> stopCode (לפענוח onwardCalls אם השרת לא מחזיר stopCode)
  const { byId: stopsById } = await loadLocalStops();

  // 🔹 שלב 2: איסוף כל הרכבים מהתחנות הקרובות
  const allVehicles = [];

  for (const stop of nearestStops) {
    const stopCode = stop.stopCode;
    if (!stopCode) continue;

    try {
      const url = `${config.API_BASE}/realtime?stopCode=${encodeURIComponent(stopCode)}`;
      const realtimeData = await utils.fetchJson(url);

      const vehicles = Array.isArray(realtimeData.vehicles) ? realtimeData.vehicles : [];
      allVehicles.push(...vehicles);
    } catch (e) {}
  }

  // 🔹 שלב 3: קיבוץ רכבים לפי routeId
  const vehiclesByRouteId = new Map();

  allVehicles.forEach(v => {
    const rid = v?.trip?.routeId;
    if (!rid) return;

    const key = String(rid);
    if (!vehiclesByRouteId.has(key)) vehiclesByRouteId.set(key, []);
    vehiclesByRouteId.get(key).push(v);
  });

  // 🔹 שלב 4: יצירת payloads במבנה של realtime של routes
  const allPayloads = [];

  for (const [routeId, vehicles] of vehiclesByRouteId.entries()) {
    const r = routeMap.get(String(routeId));
    if (!r) continue;

    // רכבים דלים
    const slimVehicles = vehicles.map(v => {
      const trip = v.trip || {};
      const calls = trip?.onwardCalls?.calls || [];
      const report = v.vehicle?.report || {};

      const pos = trip.positionOnLine;
      const loc = report.location || report || {};

      const lat = (typeof loc.lat === "number") ? loc.lat : null;
      const lon = (typeof loc.lon === "number") ? loc.lon : null;

      // נרשום גם snapshot לצורך UI (בדומה למה שהיה לך)
      const lastSnapshot = trip.lastSnapshot || report.lastReport || new Date().toISOString();
      v._lastSnapshot = lastSnapshot;

      const gtfs = r || {};
      return {
        vehicleId: v.vehicleId || v.vehicle?.id || null,
        routeId: gtfs.routeId,
        routeCode: gtfs.routeCode,
        routeNumber: gtfs.routeNumber,
        headsign: gtfs.headsign,
        bearing: v.bearing || v.geo?.bearing || 0,
        lat,
        lon,
        positionOnLine: typeof pos === "number" ? pos : null,
        onwardCalls: calls.map(c => {
          const stopIdRaw = c.stopId ?? c.stop_id ?? c.stopID ?? null;
          let stopCodeRaw = c.stopCode ?? c.stop_code ?? null;

          // אם חסר stopCode, ננסה לשחזר דרך stopId -> stopCode מתוך stops.json
          if (!stopCodeRaw && stopIdRaw && stopsById) {
            const s = stopsById.get(String(stopIdRaw));
            if (s && s.stopCode) stopCodeRaw = s.stopCode;
          }

          const stopCodeStr = stopCodeRaw != null ? String(stopCodeRaw) : null;
          const stopIdStr = stopIdRaw != null ? String(stopIdRaw) : null;

          return {
            stopCode: stopCodeStr,
            stopId: stopIdStr,
            eta: c.eta
          };
        }).filter(x => x.stopCode && x.eta)
      };
    });

    // שימוש ב-lastSnapshot מהרכב הראשון (אם יש)
    const lastSnapshot = vehicles.length > 0 ? vehicles[0]._lastSnapshot : new Date().toISOString();

    allPayloads.push({
      meta: {
        routeId: r.routeId,
        routeCode: r.routeCode,
        routeNumber: r.routeNumber,
        headsign: r.headsign,
        lastSnapshot
      },
      vehicles: slimVehicles
    });
  }

  return allPayloads;
};

// --- fallback: זמן אמת לפי routeCode (אם תרצה להשתמש בו במקום "מהתחנות") ---
module.exports.fetchRealtimeForRoutes = async function(routesStatic) {
  const allPayloads = [];

  // 🧩 מפת stopId -> stopCode (לפענוח onwardCalls אם השרת לא מחזיר stopCode)
  const { byId: stopsById } = await loadLocalStops();

  for (const r of routesStatic) {
    try {
      const realtimeUrl = `${config.API_BASE}/realtime?routeCode=${encodeURIComponent(r.routeCode)}`;
      const realtimeData = await utils.fetchJson(realtimeUrl);

      const vehiclesRaw = Array.isArray(realtimeData.vehicles) ? realtimeData.vehicles : [];

      const slimVehicles = vehiclesRaw.map(v => {
        const trip = v.trip || {};
        const calls = trip?.onwardCalls?.calls || [];
        const report = v.vehicle?.report || {};

        const pos = trip.positionOnLine;
        const loc = report.location || report || {};

        const lat = (typeof loc.lat === "number") ? loc.lat : null;
        const lon = (typeof loc.lon === "number") ? loc.lon : null;

        return {
          vehicleId: v.vehicleId || v.vehicle?.id || null,
          routeId: r.routeId,
          routeCode: r.routeCode,
          routeNumber: r.routeNumber,
          headsign: r.headsign,
          bearing: v.bearing || v.geo?.bearing || 0,
          lat,
          lon,
          positionOnLine: typeof pos === "number" ? pos : null,
          onwardCalls: calls.map(c => {
            const stopIdRaw = c.stopId ?? c.stop_id ?? c.stopID ?? null;
            let stopCodeRaw = c.stopCode ?? c.stop_code ?? null;

            // אם חסר stopCode, ננסה לשחזר דרך stopId -> stopCode מתוך stops.json
            if (!stopCodeRaw && stopIdRaw && stopsById) {
              const s = stopsById.get(String(stopIdRaw));
              if (s && s.stopCode) stopCodeRaw = s.stopCode;
            }

            const stopCodeStr = stopCodeRaw != null ? String(stopCodeRaw) : null;
            const stopIdStr = stopIdRaw != null ? String(stopIdRaw) : null;

            return {
              stopCode: stopCodeStr,
              stopId: stopIdStr,
              eta: c.eta
            };
          }).filter(x => x.stopCode && x.eta)
        };
      });

      const lastSnapshot = realtimeData?.meta?.lastSnapshot || new Date().toISOString();

      allPayloads.push({
        meta: {
          routeId: r.routeId,
          routeCode: r.routeCode,
          routeNumber: r.routeNumber,
          headsign: r.headsign,
          lastSnapshot
        },
        vehicles: slimVehicles
      });
    } catch (e) {}
  }

  return allPayloads;
};
