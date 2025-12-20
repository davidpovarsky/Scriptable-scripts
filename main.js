// main.js
// נקודת הכניסה הראשית - מנהלת את שני המודולים

const config = importModule('config');
const utils = importModule('utils');
const dataService = importModule('data');
const viewService = importModule('view');
const stationsAPI = importModule('stations/StationsAPI');
const stationsSearch = importModule('stations/StationsSearch');

// ===== STATE משותף =====
let STATE = {
  // Map state
  routesStatic: [],
  nearestStops: [],
  userLat: null,
  userLon: null,
  
  // Stations state
  selectedStops: [],
  activeStopCode: null,
  isSearchMode: false,
  
  // UI state
  viewMode: config.VIEW_MODES.BOTH, // both/map/stations
  keepRefreshing: true
};

module.exports.run = async function(argsObj) {
  const FROM_NOTIFICATION = !!(argsObj && argsObj.notification);
  const routeDate = utils.isoDateTodayLocal();

  // 1. קביעת מסלולים ראשונית
  let ROUTES = Array.isArray(config.DEFAULT_ROUTES)
    ? config.DEFAULT_ROUTES.map(r => ({ routeId: r.routeId }))
    : [];

  // טיפול בהתראה עם מסלולים
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
    } catch (e) {
      console.error("Failed reading routes from notification:", e);
    }
  }

  // 2. קבלת מיקום
  if (!FROM_NOTIFICATION) {
    try {
      Location.setAccuracyToBest();
      const loc = await Location.current();
      if (loc && typeof loc.latitude === "number" && typeof loc.longitude === "number") {
        STATE.userLat = loc.latitude;
        STATE.userLon = loc.longitude;
        console.log("Using device location:", STATE.userLat, STATE.userLon);
      }
    } catch (e) {
      console.error("Device location failed:", e);
    }

    // Fallback
    if (STATE.userLat === null || STATE.userLon === null) {
      console.log("Using fallback location…");
      const fallback = await utils.loadFallbackLocation();
      STATE.userLat = fallback.lat;
      STATE.userLon = fallback.lon;
      console.log("Server location:", fallback);
    }

    // חיפוש תחנות קרובות
    if (STATE.userLat != null && STATE.userLon != null) {
      try {
        STATE.nearestStops = await stationsAPI.findNearbyStops(STATE.userLat, STATE.userLon, [], 3, 500);
        console.log("Nearest stops:", JSON.stringify(STATE.nearestStops));

        // בחירת התחנות הקרובות למעקב
        STATE.selectedStops = STATE.nearestStops.slice(0, 3);
        if (STATE.selectedStops.length > 0) {
          STATE.activeStopCode = STATE.selectedStops[0].stopCode;
        }

        // בדיקת קווים פעילים
        const stopCodes = STATE.nearestStops.map(s => s.stopCode).filter(Boolean);
        if (stopCodes.length) {
          const activeRoutes = await dataService.fetchActiveRoutesForStops(stopCodes);
          if (Array.isArray(activeRoutes) && activeRoutes.length) {
            ROUTES = activeRoutes;
          }
        }
      } catch (e) {
        console.error("Error while building nearby routes:", e);
      }
    }
  }

  // ברירת מחדל אם אין מסלולים
  if (!Array.isArray(ROUTES) || !ROUTES.length) {
    ROUTES = Array.isArray(config.DEFAULT_ROUTES)
      ? config.DEFAULT_ROUTES.map(r => ({ routeId: r.routeId }))
      : [];
  }

  // 3. יצירת WebView
  const wv = new WebView();
  const html = viewService.getHtml();
  await wv.loadHTML(html);

  // 4. רישום מטפלי פקודות
  wv.shouldAllowRequest = (req) => {
    if (req.url.startsWith("unified://")) {
      const cmd = req.url.replace("unified://", "");
      handleCommand(cmd, wv);
      return false;
    }
    return true;
  };

  // 5. העברת מיקום למפה
  if (STATE.userLat != null && STATE.userLon != null) {
    try {
      const jsUserLoc = `window.setUserLocation && window.setUserLocation(${STATE.userLat}, ${STATE.userLon});`;
      await wv.evaluateJavaScript(jsUserLoc, false);
    } catch (e) {
      console.error("Failed injecting user location:", e);
    }
  }

  // 6. הזרקת stops.json
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

  // 7. טעינת נתוני מסלולים
  try {
    STATE.routesStatic = await dataService.fetchStaticRoutes(ROUTES, routeDate);
  } catch (e) {
    console.error("Error fetching static routes:", e);
  }

  // 8. שליחת נתונים סטטיים למפה
  if (STATE.routesStatic.length) {
    try {
      const staticPayload = STATE.routesStatic.map(r => ({
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

      const jsInit = `window.initStaticData(${JSON.stringify(staticPayload)})`;
      await wv.evaluateJavaScript(jsInit, false);
      console.log("Static data sent to WebView.");
    } catch (e) {
      console.error("Failed sending static data:", e);
    }
  }

  // 9. שליחת רשימת תחנות ראשונית
  if (STATE.selectedStops.length) {
    try {
      await wv.evaluateJavaScript(`window.addStops(${JSON.stringify(STATE.selectedStops)}, true)`);
    } catch (e) {
      console.error("Failed sending initial stops:", e);
    }
  }

  // 10. לולאת רענון
  startRefreshLoop(wv);

  // הצגת WebView
  if (FROM_NOTIFICATION) await wv.present();
  else await wv.present(true);
};

// ===== מטפל פקודות =====
async function handleCommand(cmd, wv) {
  console.log("Command received:", cmd);

  // החלפת מצב תצוגה
  if (cmd.startsWith("setViewMode/")) {
    const mode = cmd.split("/")[1];
    STATE.viewMode = mode;
    return;
  }

  // בחירת תחנה פעילה
  if (cmd.startsWith("setActiveStop/")) {
    const code = cmd.split("/")[1];
    STATE.activeStopCode = code;
    return;
  }

  // חיפוש תחנה
  if (cmd.startsWith("search/")) {
    const query = decodeURIComponent(cmd.split("/")[1]);
    const results = await stationsSearch.searchStops(query);
    await wv.evaluateJavaScript(`window.displaySearchResults(${JSON.stringify(results)})`);
    return;
  }

  // בחירת תחנה מחיפוש
  if (cmd.startsWith("selectSearchStop/")) {
    const parts = cmd.split("/");
    const stopCode = parts[1];
    const lat = parseFloat(parts[2]);
    const lon = parseFloat(parts[3]);
    
    STATE.isSearchMode = true;
    STATE.activeStopCode = stopCode;
    
    // הוספת התחנה לרשימה אם לא קיימת
    if (!STATE.selectedStops.find(s => s.stopCode === stopCode)) {
      STATE.selectedStops.unshift({ stopCode, lat, lon, name: "טוען...", distance: 0 });
      await wv.evaluateJavaScript(`window.addStops(${JSON.stringify(STATE.selectedStops)}, true)`);
    }
    
    return;
  }

  // הדגשת קו במפה (מלחיצה בממשק התחנות)
  if (cmd.startsWith("highlightRoute/")) {
    const routeId = cmd.split("/")[1];
    await wv.evaluateJavaScript(`window.highlightRoute(${routeId})`);
    return;
  }

  // הדגשת תחנה במפה
  if (cmd.startsWith("highlightStop/")) {
    const stopCode = cmd.split("/")[1];
    await wv.evaluateJavaScript(`window.highlightStop("${stopCode}")`);
    return;
  }

  // טעינת תחנות נוספות
  if (cmd === "loadMore") {
    if (STATE.userLat && STATE.userLon) {
      const moreStops = await stationsAPI.findNearbyStops(
        STATE.userLat, 
        STATE.userLon, 
        STATE.selectedStops, 
        5, 
        1000
      );
      
      moreStops.forEach(s => STATE.selectedStops.push(s));
      await wv.evaluateJavaScript(`window.addStops(${JSON.stringify(moreStops)}, false)`);
    }
  }
}

// ===== לולאת רענון =====
async function startRefreshLoop(wv) {
  
  async function pushRealtimeUpdate() {
    try {
      // רענון מפה
      if (STATE.routesStatic.length && STATE.nearestStops.length) {
        const fullData = await dataService.fetchRealtimeForRoutesFromStops(
          STATE.routesStatic, 
          STATE.nearestStops
        );
        
        const lightPayload = fullData.map(d => ({
          routeId: d.meta.routeId,
          meta: d.meta,
          vehicles: d.vehicles
        }));

        await wv.evaluateJavaScript(`window.updateRealtimeData(${JSON.stringify(lightPayload)})`);
      }

      // רענון תחנה פעילה
      if (STATE.activeStopCode) {
        const data = await stationsAPI.getStopData(STATE.activeStopCode);
        await wv.evaluateJavaScript(`window.updateStationData("${STATE.activeStopCode}", ${JSON.stringify(data)})`);
      }
      
    } catch (e) {
      console.error("Error on realtime refresh:", e);
    }
  }

  async function refreshLoop() {
    while (STATE.keepRefreshing) {
      await pushRealtimeUpdate();
      if (!STATE.keepRefreshing) break;
      await utils.sleep(config.REFRESH_INTERVAL_MS);
    }
  }

  // רענון ראשוני
  await pushRealtimeUpdate();
  
  // התחלת לולאה
  const loopPromise = refreshLoop();

  // המתנה לסגירת WebView
  try { 
    await loopPromise; 
  } catch (e) {
    console.error("Loop error:", e);
  }
  
  STATE.keepRefreshing = false;
}