// web/app.js
// נקודת הכניסה הראשית - עם Autostart קשיח + חיבור ל-Deck3D

let mapManager = null;
let busMarkers = null;
let userLocationManager = null;
let nearbyPanel = null;
let bottomSheet = null;
let modeToggle = null;

// ✅ חדש
let deck3d = null;

const staticDataStore = new Map();
const routeCards = new Map();

// =============================
// אתחול ראשוני
// =============================
const initApp = async function () {
  console.log("🚀 KavNav App Starting...");

  if (typeof MapManager === "undefined") {
    throw new Error("MapManager is not defined (bundle order / missing file).");
  }
  if (typeof L === "undefined") {
    throw new Error("Leaflet (L) is not defined. CDN failed to load?");
  }

  mapManager = new MapManager();
  mapManager.init("map");

  // לפעמים WebView/Leaflet צריכים invalidateSize אחרי שהlayout מתייצב
  setTimeout(() => {
    try { mapManager.invalidateSize(); } catch(e) {}
  }, 250);

  busMarkers = new BusMarkers(mapManager.getBusLayerGroup());
  userLocationManager = new UserLocationManager(mapManager);
  nearbyPanel = new NearbyPanel();
  bottomSheet = new BottomSheet();
  modeToggle = new ModeToggle(mapManager);

  bottomSheet.init();
  modeToggle.init();
  userLocationManager.setupLocateButton();

  // ✅ Deck3D overlay
  if (typeof Deck3D !== "undefined") {
    try {
      deck3d = new Deck3D(mapManager);
      await deck3d.init();
      console.log("🧊 Deck3D initialized");
    } catch (e) {
      console.warn("Deck3D init failed:", e);
      deck3d = null;
    }
  } else {
    console.log("ℹ️ Deck3D not found (modules/map/deck3d.js not loaded).");
  }

  console.log("✅ All managers initialized");
};

// =============================
// פונקציות גלובליות לשימוש Scriptable
// =============================
window.initNearbyStops = function (stops) {
  if (!Array.isArray(stops)) return;
  console.log("📍 Initializing nearby stops:", stops.length);

  if (nearbyPanel) {
    nearbyPanel.init(stops);
  }
};

window.setUserLocation = function (lat, lon) {
  if (userLocationManager) {
    userLocationManager.setUserLocation(lat, lon);
  }
};

window.updateStaticData = function (payload) {
  if (!payload || !Array.isArray(payload.routes)) return;

  console.log("📦 Receiving static data:", payload.routes.length, "routes");

  payload.routes.forEach((p) => {
    const routeId = p.routeId;
    staticDataStore.set(routeId, p);

    // יצירת כרטיס מסלול
    const color = p.meta && p.meta.operatorColor ? p.meta.operatorColor : "#29b6f6";
    const card = new RouteCard(routeId, p.meta, p.stops, color);
    card.create();
    routeCards.set(routeId, card);
  });

  // Fit to shapes אם יש
  const allShapeCoords = [];
  payload.routes.forEach((p) => {
    if (Array.isArray(p.shapeCoords) && p.shapeCoords.length) {
      allShapeCoords.push(p.shapeCoords);
    }
  });

  if (mapManager && allShapeCoords.length) {
    mapManager.fitBoundsToShapes(allShapeCoords);
  }

  console.log("✅ Static data initialized");
  console.log("Static data sent to WebView.");
};

window.updateRealtimeData = function (updates) {
  if (!Array.isArray(updates)) return;
  console.log("🔄 Updating realtime data:", updates.length, "routes");

  if (mapManager) {
    mapManager.clearBuses();
  }

  // ✅ נאסוף את כל האוטובוסים לכל המסלולים לעדכון Deck3D אחד
  const all3dVehicles = [];

  updates.forEach((u) => {
    const routeId = u.routeId;
    const staticData = staticDataStore.get(routeId);

    if (!staticData) {
      console.warn(`No static data for route ${routeId}`);
      return;
    }

    const meta = staticData.meta || {};
    const colorHex = meta.operatorColor || "#29b6f6";
    const routeShort = (meta.routeShortName || meta.lineNumber || meta.routeNumber || "").toString();

    // עדכון כרטיס
    const card = routeCards.get(routeId);
    if (card) {
      card.update(u);
    }

    // ציור 2D markers רגיל
    if (u.vehicles && u.vehicles.length && busMarkers) {
      busMarkers.drawBuses(u.vehicles, colorHex, staticData.shapeCoords);
    }

    // ✅ הכנה ל-3D
    if (u.vehicles && u.vehicles.length) {
      u.vehicles.forEach((v) => {
        if (v && typeof v.lon === "number" && typeof v.lat === "number") {
          all3dVehicles.push({
            lon: v.lon,
            lat: v.lat,
            bearing: (typeof v.bearing === "number" ? v.bearing : (typeof v.heading === "number" ? v.heading : 0)),
            color: colorHex,
            route: routeShort,
          });
        }
      });
    }
  });

  if (nearbyPanel) {
    nearbyPanel.updateTimes(updates);
  }

  // ✅ עדכון 3D בשכבה אחת (יעיל להרבה אוטובוסים)
  if (deck3d) {
    deck3d.setVehicles(all3dVehicles);
  }

  console.log("✅ Realtime data updated");
};

// =============================
// Autostart קשיח + guard נגד פעמיים
// =============================
(function autostart() {
  if (window.__KAVNAV_STARTED__) return;
  window.__KAVNAV_STARTED__ = true;

  const run = async () => {
    try {
      await initApp();
    } catch (e) {
      console.error("Init error:", e);
      // נזרוק כדי שה-overlay ב-view.js יציג
      throw e;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => run());
  } else {
    run();
  }
})();