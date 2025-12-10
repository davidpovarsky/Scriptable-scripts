// main.js
// נקודת הכניסה שמנהלת את הכל

const config = importModule('config');
const utils = importModule('utils');
const dataService = importModule('data');
const viewService = importModule('view');

// נשתמש בפונקציה אסינכרונית כדי שנוכל לקרוא לה מבחוץ
module.exports.run = async function(argsObj) {

  const FROM_NOTIFICATION = !!(argsObj && argsObj.notification);
  const routeDate = utils.isoDateTodayLocal();

  // 1. קביעת מסלולים ראשונית
  let ROUTES = Array.isArray(config.DEFAULT_ROUTES)
    ? config.DEFAULT_ROUTES.map(r => ({ routeId: r.routeId }))
    : [];

  // אם הגיעה התראה עם מסלולים → נכבד אותה
  if (argsObj && argsObj.notification && argsObj.notification.userInfo) {
    try {
      const ui = argsObj.notification.userInfo;

      if (Array.isArray(ui.routes) && ui.routes.length) {
        ROUTES = ui.routes
          .map((r) => {
            if (typeof r === "number") return { routeId: r };
            if (typeof r === "string") return { routeId: Number(r) };
            if (r && r.routeId != null) return { routeId: Number(r.routeId) };
            return null;
          })
          .filter((x) => x && Number.isFinite(x.routeId));
      }
      else if (Array.isArray(ui.routeIds) && ui.routeIds.length) {
        ROUTES = ui.routeIds
          .map((id) => Number(id))
          .filter((n) => Number.isFinite(n))
          .map((n) => ({ routeId: n }));
      }
    } catch (e) {
      console.error("Failed reading routes from notification.userInfo:", e);
    }
  }

  // נשמור מיקום משתמש כדי להעביר ל-HTML
  let userLat = null;
  let userLon = null;

  // 2. קווים סביבי אוטומטית
  if (!FROM_NOTIFICATION) {

    // ניסיון מהמכשיר
    try {
      Location.setAccuracyToBest();
      const loc = await Location.current();

      if (loc && typeof loc.latitude === "number" && typeof loc.longitude === "number") {
        userLat = loc.latitude;
        userLon = loc.longitude;
        console.log("Using device location:", userLat, userLon);
      }
    } catch (e) {
      console.error("Device location failed:", e);
    }

    // fallback לשרת
    if (userLat === null || userLon === null) {
      console.log("Using fallback location…");
      const fallback = await utils.loadFallbackLocation();
      userLat = fallback.lat;
      userLon = fallback.lon;
      console.log("Server location:", fallback);
    }

    // אם עדיין אין מיקום — דילוג
    if (userLat != null && userLon != null) {
      try {
        const nearestStops = await dataService.findNearestStops(userLat, userLon, 3);
        const stopCodes = nearestStops
          .map((s) => (s && s.stopCode ? String(s.stopCode) : ""))
          .filter(Boolean);

        console.log("Nearest stops:", JSON.stringify(nearestStops));

        if (stopCodes.length) {
          const activeRoutes = await dataService.fetchActiveRoutesForStops(stopCodes);
          console.log("Active routes near user:", JSON.stringify(activeRoutes));

          if (Array.isArray(activeRoutes) && activeRoutes.length) {
            ROUTES = activeRoutes;
          }
        }
      } catch (e) {
        console.error("Error while building nearby routes:", e);
      }
    }
  }

  // אם עדיין אין מסלולים — ברירת מחדל
  if (!Array.isArray(ROUTES) || !ROUTES.length) {
    ROUTES = Array.isArray(config.DEFAULT_ROUTES)
      ? config.DEFAULT_ROUTES.map(r => ({ routeId: r.routeId }))
      : [];
  }

  // 3. יצירת WebView
  const wv = new WebView();
  const html = viewService.getHtml();
  await wv.loadHTML(html);

  // העברת מיקום המשתמש (אם קיים) ל-HTML – הכפתור 📍 ישתמש בזה
  if (userLat != null && userLon != null) {
    try {
      const jsUserLoc = `window.setUserLocation && window.setUserLocation(${userLat}, ${userLon});`;
      await wv.evaluateJavaScript(jsUserLoc, false);
    } catch (e) {
      console.error("Failed injecting user location into WebView:", e);
    }
  }

  // 4. הזרקת stops.json// 4. הזרקת stops.json מהריפו דרך ה־cache של data.js
try {
  const stopsData = await importModule('data').loadLocalStops();
  const stopsArray = Array.from(stopsData.byId.values());

  const js = `window.stopsDataJson = ${JSON.stringify(stopsArray)};`;
  await wv.evaluateJavaScript(js, false);

  console.log(`Injected ${stopsArray.length} stops from cache into HTML.`);
} catch (e) {
  console.error("Failed injecting stops.json:", e);
}

  // 5. נתוני בסיס
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

  // 6. רענון זמן אמת
  let keepRefreshing = true;

  async function pushPayloadOnce() {
    try {
      const payloads = await dataService.fetchRealtimeForRoutes(routesStatic);
      const js = `window.updateData(${JSON.stringify(payloads)})`;
      await wv.evaluateJavaScript(js, false);
    } catch (e) {
      console.error("Error on realtime refresh:", e);
    }
  }

  async function refreshLoop() {
    while (keepRefreshing) {
      await pushPayloadOnce();
      if (!keepRefreshing) break;
      await utils.sleep(config.REFRESH_INTERVAL_MS);
    }
  }

  await pushPayloadOnce();
  const loopPromise = refreshLoop();

  if (FROM_NOTIFICATION) await wv.present();
  else await wv.present(true);

  keepRefreshing = false;
  try { await loopPromise; } catch (e) {}
};
