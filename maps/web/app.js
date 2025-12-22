// web/app.js
// נקודת הכניסה הראשית - גרסה סופית מתוקנת

// ============================================
// משתנים גלובליים
// ============================================
let mapManager = null;
let busMarkers = null;
let userLocationManager = null;
let bottomSheet = null;
let modeToggle = null;

const staticDataStore = new Map();
const routeCards = new Map();

// ============================================
// אתחול ראשוני
// ============================================
const initApp = async function() {
  console.log("🚀 KavNav App Starting...");

  mapManager = new MapManager();
  mapManager.init('map');

  busMarkers = new BusMarkers(mapManager.getBusLayerGroup());
  userLocationManager = new UserLocationManager(mapManager);
  bottomSheet = new BottomSheet();
  modeToggle = new ModeToggle(mapManager);

  bottomSheet.init();
  modeToggle.init();
  userLocationManager.setupLocateButton();

  // אתחול UI של תחנות (אם המודול נטען)
  if (window.KavNavStopsPanel && typeof window.KavNavStopsPanel.ensureReady === 'function') {
    window.KavNavStopsPanel.ensureReady();
  }

  console.log("✅ All managers initialized");
};

// ============================================
// פונקציות גלובליות לשימוש Scriptable
// ============================================

window.initNearbyStops = function(stops) {
  if (!Array.isArray(stops)) return;
  console.log("📍 Initializing nearby stops:", stops.length);

  if (window.KavNavStopsPanel && typeof window.KavNavStopsPanel.addStops === 'function') {
    window.KavNavStopsPanel.addStops(stops);
  } else {
    console.warn("⚠️ KavNavStopsPanel not loaded yet");
  }
};

window.setUserLocation = function(lat, lon) {
  if (!mapManager) return;
  console.log("👤 Setting user location:", lat, lon);
  mapManager.setUserLocation(lat, lon);
};

window.initStaticData = function(payloads) {
  if (!Array.isArray(payloads)) return;
  console.log("📦 Receiving static data:", payloads.length, "routes");

  const allShapeCoords = [];

  payloads.forEach(p => {
    const routeId = p.meta.routeId;
    staticDataStore.set(routeId, p);

    if (p.shapeCoords && p.shapeCoords.length) {
      allShapeCoords.push(p.shapeCoords);
    }

    const color = getVariedColor(p.meta.operatorColor || "#1976d2", String(routeId));

    if (mapManager && p.shapeCoords && p.shapeCoords.length) {
      mapManager.drawRoutePolyline(p.shapeCoords, color);
    }

    const card = new RouteCard(routeId, p.meta, p.stops, color);
    card.create();
    routeCards.set(routeId, card);
  });

  if (mapManager && allShapeCoords.length) {
    mapManager.fitBoundsToShapes(allShapeCoords);
  }

  console.log("✅ Static data initialized");
};

window.updateRealtimeData = function(updates) {
  if (!Array.isArray(updates)) return;
  console.log("🔄 Updating realtime data:", updates.length, "routes");

  if (mapManager) {
    mapManager.clearBuses();
  }

  updates.forEach(u => {
    const routeId = u.routeId;
    const staticData = staticDataStore.get(routeId);

    if (!staticData) {
      console.warn(`No static data for route ${routeId}`);
      return;
    }

    const color = getVariedColor(staticData.meta.operatorColor || "#1976d2", String(routeId));

    const card = routeCards.get(routeId);
    if (card) {
      card.update(u);
    }

    if (u.vehicles && u.vehicles.length && busMarkers) {
      busMarkers.drawBuses(u.vehicles, color, staticData.shapeCoords);
    }
  });

  // ✅ עדכון הפאנל החדש (Project2 UI) מהפיד הקיים
  if (window.KavNavStopsPanel && typeof window.KavNavStopsPanel.updateFromRealtimePayload === 'function') {
    window.KavNavStopsPanel.updateFromRealtimePayload(updates);
  }

  console.log("✅ Realtime data updated");
};

console.log("📱 KavNav Client Script Loaded");
