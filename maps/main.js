// main.js
// נקודת הכניסה שמנהלת את הכל - Scriptable בלבד

const config = importModule('config');
const utils = importModule('utils');
const dataService = importModule('data');
const viewService = importModule('view');

module.exports.run = async function(argsObj) {

  const FROM_NOTIFICATION = !!(argsObj && argsObj.notification);
  const routeDate = utils.isoDateTodayLocal();

  // 1. קביעת מסלולים ראשונית
  let ROUTES = Array.isArray(config.DEFAULT_ROUTES)
    ? config.DEFAULT_ROUTES.map(r => ({ routeId: r.routeId }))
    : [];

  // 2. מיקום + תחנות קרובות
  let userLat = null;
  let userLon = null;
  let nearestStops = [];

  try {
    const loc = await utils.getDeviceLocation();
    userLat = loc.lat;
    userLon = loc.lon;
    console.log("Using device location:", userLat, userLon);
  } catch (e) {
    console.error("Failed getting device location:", e);
  }

  // (כאן נשאר הקוד שלך שמחשב nearestStops וכו'...)

  // 3. יצירת WebView
  const wv = new WebView();
  const html = viewService.getHtml();
  await wv.loadHTML(html);

  // --- 3D buses config (deck.gl) ---
  try {
    const cfg3d = {
      enabled: !!config.ENABLE_DECKGL_3D,
      glbUrl: config.BUS_MODEL_GLB_URL || null,
      sizeScale: config.BUS_MODEL_SIZE_SCALE ?? 25,
      elevationMeters: config.BUS_MODEL_ELEVATION_METERS ?? 6,
      yawOffsetDeg: config.BUS_MODEL_YAW_OFFSET_DEG ?? 0,
      pitchDeg: config.DECK_PITCH_DEG ?? 50,
      zoomOffset: config.DECK_ZOOM_OFFSET ?? 0
    };
    const js3d = `window.set3DConfig && window.set3DConfig(${JSON.stringify(cfg3d)});`;
    await wv.evaluateJavaScript(js3d, false);
    console.log("Injected 3D config to View");
  } catch (e) {
    console.error("Failed injecting 3D config:", e);
  }

  // --- הזרקת התחנות הקרובות לתצוגה ---
  if (nearestStops && nearestStops.length) {
    try {
      const jsStops = `window.initNearbyStops && window.initNearbyStops(${JSON.stringify(nearestStops)});`;
      await wv.evaluateJavaScript(jsStops, false);
      console.log("Injected nearby stops to View");
    } catch (e) {
      console.error("Failed injecting nearby stops:", e);
    }
  }

  // --- הזרקת מיקום משתמש ---
  if (userLat && userLon) {
    try {
      const jsLoc = `window.setUserLocation && window.setUserLocation(${userLat}, ${userLon});`;
      await wv.evaluateJavaScript(jsLoc, false);
    } catch (e) {
      console.error("Failed injecting user location:", e);
    }
  }

  // 4. שליפת סטטי
  let routesStatic = [];
  try {
    routesStatic = await dataService.fetchStaticRoutes(ROUTES, routeDate);
  } catch (e) {
    console.error("Error fetching static routes:", e);
  }

  if (!routesStatic.length) {
    if (FROM_NOTIFICATION) await wv.present();
    else await wv.present(true);
    return;
  }

  // --- שליחת הנתונים הכבדים פעם אחת בלבד (ב-batches) ---
  // NOTE: אנחנו שולחים כל מסלול בנפרד כדי לא לפוצץ את מגבלת evaluateJavaScript
  try {
    const staticPayload = routesStatic.map(r => ({
      meta: {
        routeId: r.routeId,
        routeCode: r.routeCode,
        operatorColor: r.operatorColor,
        headsign: r.headsign,
        routeNumber: r.routeMeta?.routeNumber,
        routeDate: r.routeDate
      },
      stops: r.routeStops,
      shapeCoords: r.shapeCoords
    }));

    for (let i = 0; i < staticPayload.length; i++) {
      const one = staticPayload[i];
      const jsInitOne = `window.initStaticData && window.initStaticData([${JSON.stringify(one)}]);`;
      await wv.evaluateJavaScript(jsInitOne, false);
    }
    console.log("Static data sent to WebView (batched).");
  } catch (e) {
    console.error("Failed sending static data:", e);
  }

  // 6. רענון זמן אמת - ב-batches
  let keepRefreshing = true;

  async function pushRealtimeUpdate() {
    try {
      let fullData;

      if (nearestStops && nearestStops.length > 0) {
        console.log("Fetching realtime from stops:", nearestStops.map(s => s.stopCode).join(', '));
        fullData = await dataService.fetchRealtimeForRoutesFromStops(routesStatic, nearestStops);
      } else {
        console.log("No stops available, using old method (routeCode)");
        fullData = await dataService.fetchRealtimeForRoutes(routesStatic);
      }

      const lightPayload = fullData.map(d => ({
        routeId: d.routeId,
        lastUpdate: d.lastUpdate,
        vehicles: d.vehicles
      }));

      // NOTE: שולחים ב-batches כדי לא לפוצץ מגבלות evaluateJavaScript (הרבה אוטובוסים)
      await wv.evaluateJavaScript(`window.beginRealtimeUpdate && window.beginRealtimeUpdate();`, false);
      for (let i = 0; i < lightPayload.length; i++) {
        const u = lightPayload[i];
        const jsChunk = `window.applyRealtimeUpdate && window.applyRealtimeUpdate(${JSON.stringify(u)});`;
        await wv.evaluateJavaScript(jsChunk, false);
      }
      await wv.evaluateJavaScript(`window.endRealtimeUpdate && window.endRealtimeUpdate();`, false);

    } catch (e) {
      console.error("Error on realtime refresh:", e);
    }
  }

  async function refreshLoop() {
    while (keepRefreshing) {
      await pushRealtimeUpdate();
      await new Promise(res => setTimeout(res, config.REFRESH_INTERVAL_MS || 15000));
    }
  }

  refreshLoop().catch(e => console.error("refreshLoop crashed:", e));

  if (FROM_NOTIFICATION) await wv.present();
  else await wv.present(true);

  keepRefreshing = false;
};