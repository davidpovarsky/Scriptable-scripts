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

  // 2. מיקום משתמש
  let userLat = null;
  let userLon = null;

  try {
    const loc = await utils.getUserLocationMaybe();
    if (loc && typeof loc.lat === "number" && typeof loc.lon === "number") {
      userLat = loc.lat;
      userLon = loc.lon;
      console.log("Using device location:", userLat, userLon);
    }
  } catch (e) {
    console.warn("Failed getting device location:", e);
  }

  // 2.1 תחנות קרובות
  let nearestStops = [];
  try {
    if (userLat != null && userLon != null) {
      nearestStops = await dataService.findNearestStops(userLat, userLon, config.MAX_NEAREST_STOPS);
      console.log("Nearest stops:", nearestStops.map(s => s.stopCode).join(", "));
    }
  } catch (e) {
    console.warn("Failed finding nearest stops:", e);
  }

  // 2.2 קווים פעילים ליד המשתמש
  try {
    if (nearestStops && nearestStops.length > 0) {
      const stopCodes = nearestStops.map(s => s.stopCode);
      const activeRouteIds = await dataService.fetchActiveRoutesForStops(stopCodes);
      if (activeRouteIds && activeRouteIds.length > 0) {
        ROUTES = activeRouteIds.map(rid => ({ routeId: rid }));
      }
      console.log("Active routes near user:", ROUTES.map(r => r.routeId).join(", "));
    }
  } catch (e) {
    console.warn("Failed fetching active routes:", e);
  }

  if (!ROUTES || ROUTES.length === 0) {
    ROUTES = Array.isArray(config.DEFAULT_ROUTES)
      ? config.DEFAULT_ROUTES.map(r => ({ routeId: r.routeId }))
      : [];
  }

  // 3. יצירת WebView
  const wv = new WebView();
  const html = viewService.getHtml();
  await wv.loadHTML(html);

  // ממתין שה-JS בדף ייטען (כדי שהזרקת נתונים לא תיכשל)
  async function waitForWebAppReady() {
    const maxTries = 60; // ~9 שניות
    for (let i = 0; i < maxTries; i++) {
      try {
        const ok = await wv.evaluateJavaScript(
          "typeof window.initStaticData==='function' && typeof window.updateRealtimeData==='function'",
          true
        );
        if (ok) return true;
      } catch (e) {
        // עדיין לא מוכן
      }
      await utils.sleep(150);
    }
    return false;
  }

  const ready = await waitForWebAppReady();
  if (!ready) {
    console.warn("⚠️ Web app not ready yet - injections may fail (missing CSS/JS).");
  }

  // העברת מיקום המשתמש (אם קיים) ל-HTML
  if (userLat != null && userLon != null) {
    try {
      const jsUserLoc = `window.setUserLocation && window.setUserLocation(${userLat}, ${userLon});`;
      await wv.evaluateJavaScript(jsUserLoc, false);
    } catch (e) {
      console.error("Failed injecting user location into WebView:", e);
    }
  }

  // 4. הזרקת stops.json
  try {
    const fm = FileManager.iCloud();
    const stopsFile = fm.joinPath(fm.documentsDirectory(), "stops.json");
    try { await fm.downloadFileFromiCloud(stopsFile); } catch (e) {}
    if (fm.fileExists(stopsFile)) {
      const stopsRaw = fm.readString(stopsFile);
      const js = `window.stopsDataJson = ${JSON.stringify(stopsRaw)};`;
      await wv.evaluateJavaScript(js, false);
    }
  } catch (e) {
    console.error("Failed injecting stops.json:", e);
  }

  // 5. נתוני בסיס (סטטיים)
  let routesStatic = [];
  try {
    routesStatic = await dataService.fetchStaticRoutes(ROUTES, routeDate);
  } catch (e) {
    console.error("Error fetching static routes:", e);
  }

  try {
    const staticPayload = routesStatic.map(r => ({
      meta: r.meta,
      shapes: r.shapes,
      stops: r.stops
    }));

    const jsInit = `if (typeof window.initStaticData==='function') { window.initStaticData(${JSON.stringify(staticPayload)}); }`;
    await wv.evaluateJavaScript(jsInit, false);
    console.log("Static data sent to WebView.");
  } catch (e) {
    console.error("Failed sending static data:", e);
  }

  // ===================================================================
  // 🆕 6. רענון זמן אמת - כעת מבוסס על תחנות!
  // ===================================================================

  let keepRefreshing = true;

  async function pushRealtimeUpdate() {
    try {
      // 🔹 במקום לקרוא ל-fetchRealtimeForRoutes (הישנה),
      //    נקרא ל-fetchRealtimeForRoutesFromStops (החדשה)

      let fullData;

      if (nearestStops && nearestStops.length > 0) {
        // 🆕 יש תחנות קרובות - נשתמש בהן
        console.log("Fetching realtime from stops:", nearestStops.map(s => s.stopCode).join(', '));
        fullData = await dataService.fetchRealtimeForRoutesFromStops(routesStatic, nearestStops);
      } else {
        // fallback
        console.log("No stops available, using old method (routeCode)");
        fullData = await dataService.fetchRealtimeForRoutes(routesStatic);
      }

      const lightPayload = fullData.map(d => ({
        routeId: d.meta.routeId,
        meta: d.meta,
        vehicles: d.vehicles
      }));

      const jsUpdate = `if (typeof window.updateRealtimeData==='function') { window.updateRealtimeData(${JSON.stringify(lightPayload)}); }`;
      await wv.evaluateJavaScript(jsUpdate, false);

    } catch (e) {
      console.error("Error on realtime refresh:", e);
    }
  }

  async function refreshLoop() {
    while (keepRefreshing) {
      await pushRealtimeUpdate();
      if (!keepRefreshing) break;
      await utils.sleep(config.REFRESH_INTERVAL_MS);
    }
  }

  // התחלת הלולאה
  await pushRealtimeUpdate();
  const loopPromise = refreshLoop();

  if (FROM_NOTIFICATION) await wv.present();
  else await wv.present(true);

  // סיום
  keepRefreshing = false;
  try { await loopPromise; } catch (e) {}
};