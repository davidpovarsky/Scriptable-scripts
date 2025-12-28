// main.js
// נקודת הכניסה שמנהלת את הכל - Scriptable בלבד
// --- importModule polyfill (למקרה שמריצים דרך eval / סביבה בלי importModule) ---
function safeImportModule(name) {
  if (typeof importModule === 'function') return importModule(name);

  // fallback: לטעון מהקובץ ולהריץ כ-CommonJS
  if (typeof FileManager === 'undefined') {
    throw new Error("importModule is not available and FileManager is not available.");
  }

  const fm = FileManager.local();
  const baseDir = fm.documentsDirectory();
  const path = fm.joinPath(baseDir, name.endsWith('.js') ? name : (name + '.js'));

  if (!fm.fileExists(path)) {
    throw new Error("Module file not found: " + path);
  }

  const code = fm.readString(path);
  const module = { exports: {} };
  const exports = module.exports;

  const fn = new Function('module', 'exports', code);
  fn(module, exports);

  return module.exports;
}
const config = safeImportModule('config');
const utils = safeImportModule('utils');
const dataService = safeImportModule('data');
const viewService = safeImportModule('view');

// main.js - תיקון סופי (הפעם באמת!)

module.exports.run = async function(argsObj) {
  const FROM_NOTIFICATION = !!(argsObj && argsObj.notification);
  const routeDate = utils.isoDateTodayLocal();

  let ROUTES = Array.isArray(config.DEFAULT_ROUTES)
    ? config.DEFAULT_ROUTES.map(r => ({ routeId: r.routeId }))
    : [];

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

  let userLat = null;
  let userLon = null;
  let nearestStops = [];

  if (!FROM_NOTIFICATION) {
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

    if (userLat === null || userLon === null) {
      console.log("Using fallback location…");
      const fallback = await utils.loadFallbackLocation();
      userLat = fallback.lat;
      userLon = fallback.lon;
      console.log("Server location:", fallback);
    }

    if (userLat != null && userLon != null) {
      try {
        nearestStops = await dataService.findNearestStops(userLat, userLon, 3);
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

  if (!Array.isArray(ROUTES) || !ROUTES.length) {
    ROUTES = Array.isArray(config.DEFAULT_ROUTES)
      ? config.DEFAULT_ROUTES.map(r => ({ routeId: r.routeId }))
      : [];
  }

  const wv = new WebView();
  const html = viewService.getHtml();
  await wv.loadHTML(html);
  
  if (nearestStops && nearestStops.length) {
    try {
      const jsStops = `window.initNearbyStops && window.initNearbyStops(${JSON.stringify(nearestStops)});`;
      await wv.evaluateJavaScript(jsStops, false);
      console.log("Injected nearby stops to View");
    } catch (e) {
      console.error("Failed to inject nearby stops:", e);
    }
  }

  if (userLat != null && userLon != null) {
    try {
      const jsUserLoc = `window.setUserLocation && window.setUserLocation(${userLat}, ${userLon});`;
      await wv.evaluateJavaScript(jsUserLoc, false);
    } catch (e) {
      console.error("Failed injecting user location into WebView:", e);
    }
  }

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

    const jsInit = `window.initStaticData(${JSON.stringify(staticPayload)})`;
    await wv.evaluateJavaScript(jsInit, false);
    console.log("Static data sent to WebView.");
  } catch (e) {
    console.error("Failed sending static data:", e);
  }

  // ===================================================================
  // 🔥 לולאת רענון - גרסה מתוקנת סופית!
  // ===================================================================
  
  let keepRefreshing = true;
  let refreshCount = 0;

  async function pushRealtimeUpdate() {
    if (!keepRefreshing) return;
    
    refreshCount++;
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Refresh #${refreshCount} starting...`);
      
      let fullData;
      if (nearestStops && nearestStops.length > 0) {
        const stopsList = nearestStops.map(s => s.stopCode).join(', ');
        console.log(`   Fetching from ${nearestStops.length} stops: ${stopsList}`);
        fullData = await dataService.fetchRealtimeForRoutesFromStops(routesStatic, nearestStops);
      } else {
        console.log(`   No stops available, using old method (routeCode)`);
        fullData = await dataService.fetchRealtimeForRoutes(routesStatic);
      }
      
      const lightPayload = fullData.map(d => ({
        routeId: d.meta.routeId,
        meta: d.meta,
        vehicles: d.vehicles
      }));

      const jsUpdate = `window.updateRealtimeData(${JSON.stringify(lightPayload)})`;
      await wv.evaluateJavaScript(jsUpdate, false);
      
      const elapsed = Date.now() - startTime;
      console.log(`✅ Refresh #${refreshCount} completed in ${elapsed}ms`);
      
    } catch (e) {
      console.error(`❌ Refresh #${refreshCount} error:`, e);
    }
  }

  async function refreshLoop() {
  const intervalMs = Number(config.REFRESH_INTERVAL_MS) || 10000;

  console.log(`🔁 Refresh loop started (interval: ${intervalMs}ms)`);
  console.log(`   Monitoring ${nearestStops.length} stops`);

  while (keepRefreshing) {
    console.log(`⏳ Waiting ${intervalMs}ms until next refresh...`);
    await utils.sleep(intervalMs);

    if (!keepRefreshing) {
      console.log("🛑 Loop stopping (keepRefreshing = false)");
      break;
    }

    await pushRealtimeUpdate();
  }

  console.log("🏁 Refresh loop ended");
}
  // ===================================================================
  // 🎯 הסדר הנכון: הפעלת רענונים לפני present()
  // ===================================================================
  
  // התחל את הרענון הראשוני (אסינכרונית - לא ממתין!)
  await pushRealtimeUpdate();
const loopPromise = refreshLoop();
  // עכשיו הצג את החלון (זה חוסם עד סגירה)
  if (FROM_NOTIFICATION) await wv.present();
  else await wv.present(true);

  // כשמגיעים לכאן, המשתמש סגר את החלון
  keepRefreshing = false;
  console.log("👋 App window closed, stopping refresh loop...");
  
  try { 
    await loopPromise; 
  } catch (e) {
    console.error("Loop cleanup error:", e);
  }
  
  console.log("✅ KavNav completed!");
};
