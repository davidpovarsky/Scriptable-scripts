// main.js
// נקודת הכניסה שמנהלת את הכל

const config = importModule('config');
const utils = importModule('utils');
const dataService = importModule('data');
const viewService = importModule('view');

// נשתמש בפונקציה אסינכרונית כדי שנוכל לקרוא לה מבחוץ
module.exports.run = async function(argsObj) {

  // האם הופעל מתוך התראה
  const FROM_NOTIFICATION = !!(argsObj && argsObj.notification);
  const routeDate = utils.isoDateTodayLocal();

  // -----------------------------
  // 1. קביעת מסלולים ראשונית
  // -----------------------------
  let ROUTES = Array.isArray(config.DEFAULT_ROUTES)
    ? config.DEFAULT_ROUTES.map(r => ({ routeId: r.routeId }))
    : [];

  // קודם כל – אם הגיעה התראה עם userInfo שמכילה מסלולים, נכבד אותה
  if (argsObj && argsObj.notification && argsObj.notification.userInfo) {
    try {
      const ui = argsObj.notification.userInfo;

      // אפשרות 1: מערך אובייקטים של מסלולים
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
      // אפשרות 2: מערך של routeIds בלבד
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

  // -------------------------------------------------
  // 2. אם לא הגיעה התראה – ננסה "קווים סביבי" אוטומטית
  // -------------------------------------------------
  if (!FROM_NOTIFICATION) {

  let userLat = null;
  let userLon = null;

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

  // שימוש ב־fallback אם המכשיר לא נתן מיקום
  if (userLat === null || userLon === null) {
    console.log("Using fallback location from server…");
    const fallback = await utils.loadFallbackLocation();

    userLat = fallback.lat;
    userLon = fallback.lon;

    console.log("Server location:", fallback);
  }

  // אם עדיין אין מיקום → מדלגים
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

      // שליפת 3 התחנות הקרובות שיש להן stopCode
      const nearestStops = await dataService.findNearestStops(userLat, userLon, 3);
      const stopCodes = nearestStops
        .map((s) => (s && s.stopCode != null ? String(s.stopCode) : ""))
        .filter((c) => c);

      console.log("Nearest stops:", JSON.stringify(nearestStops));

      if (stopCodes.length) {
        // קווים שיש להם זמן אמת בתחנות האלו (מבוסס על /realtime?stopCode=XXX)
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

  // אם עדיין אין שום מסלול – נחזור לברירת מחדל
  if (!Array.isArray(ROUTES) || !ROUTES.length) {
    ROUTES = Array.isArray(config.DEFAULT_ROUTES)
      ? config.DEFAULT_ROUTES.map(r => ({ routeId: r.routeId }))
      : [];
  }

  // -----------------------------
  // 3. הכנת WebView ו-HTML
  // -----------------------------
  const wv = new WebView();
  const html = viewService.getHtml();
  await wv.loadHTML(html);

  // -----------------------------
  // 4. הזרקת stops.json לתוך ה־WebView
  // -----------------------------
  try {
    const fm = FileManager.iCloud();
    const stopsFile = fm.joinPath(fm.documentsDirectory(), "stops.json");
    try { await fm.downloadFileFromiCloud(stopsFile); } catch (e) {}
    if (fm.fileExists(stopsFile)) {
      const stopsRaw = fm.readString(stopsFile);
      const js = `window.stopsDataJson = ${JSON.stringify(stopsRaw)};`;
      await wv.evaluateJavaScript(js, false);
    } else {
      console.error("stops.json not found in iCloud documentsDirectory");
    }
  } catch (e) {
    console.error("Failed injecting stops.json into WebView:", e);
  }

  // -----------------------------
  // 5. טעינת נתוני בסיס (סטטי)
  // -----------------------------
  let routesStatic = [];
  try {
    routesStatic = await dataService.fetchStaticRoutes(ROUTES, routeDate);
  } catch (e) {
    console.error("Error fetching static routes:", e);
  }

  if (!Array.isArray(routesStatic) || !routesStatic.length) {
    console.error("No static routes loaded at all, aborting.");
    // בכל זאת נציג את המסך הריק כדי שלא יהיה קריסה
    if (FROM_NOTIFICATION) {
      await wv.present();
    } else {
      await wv.present(true);
    }
    return;
  }

  // -----------------------------
  // 6. פונקציית רענון זמן אמת
  // -----------------------------
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

  // נריץ רענון ראשון לפני הצגה
  await pushPayloadOnce();

  // התחלת הלולאה ברקע
  const loopPromise = refreshLoop();

  // הצגה
  if (FROM_NOTIFICATION) {
    await wv.present();
  } else {
    await wv.present(true);
  }

  // סיום
  keepRefreshing = false;
  try { await loopPromise; } catch (e) { console.error("Loop error: " + e); }
};
