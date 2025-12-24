// web/app.js
// נקודת הכניסה הראשית - גרסה עם תמיכה ב-3D buses (deck.gl) + batch realtime

let mapManager = null;
let busMarkers = null;
let userLocationManager = null;
let nearbyPanel = null;
let bottomSheet = null;
let modeToggle = null;

// 🧊 deck.gl (אופציונלי)
let deck3d = null;
let deck3dConfig = null;

const staticDataStore = new Map();
const routeCards = new Map();

function ensureDeck3D() {
  try {
    if (!deck3dConfig || !deck3dConfig.enabled) return;
    if (!mapManager || !mapManager.getMap) return;
    if (deck3d) return;

    if (!window.Deck3D) {
      console.warn("🧊 Deck3D class not found (modules/map/deck3d.js not loaded?)");
      return;
    }

    deck3d = new window.Deck3D(mapManager.getMap(), deck3dConfig);
  } catch (e) {
    console.warn("🧊 Failed to init Deck3D:", e);
    deck3d = null;
  }
}

const initApp = async function() {
  console.log("🚀 KavNav App Starting...");

  mapManager = new MapManager();
  mapManager.init('map');

  busMarkers = new BusMarkers(mapManager.getBusLayerGroup());
  userLocationManager = new UserLocationManager(mapManager);
  nearbyPanel = new NearbyPanel();
  bottomSheet = new BottomSheet();
  modeToggle = new ModeToggle(mapManager);

  bottomSheet.init();
  modeToggle.init();
  userLocationManager.setupLocateButton();

  ensureDeck3D();

  console.log("✅ All managers initialized");
};

document.addEventListener("DOMContentLoaded", () => {
  initApp().catch(e => console.error("initApp failed:", e));
});

// 🧊 נקרא מ-Scriptable מיד אחרי loadHTML
window.set3DConfig = function(cfg) {
  deck3dConfig = cfg || null;
  console.log("🧊 set3DConfig:", deck3dConfig);
  ensureDeck3D();
};

window.initNearbyStops = function(stops) {
  if (!Array.isArray(stops)) return;
  console.log("🚌 initNearbyStops:", stops.length);
  if (nearbyPanel) nearbyPanel.init(stops);
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

    if (p.shapeCoords && p.shapeCoords.length) allShapeCoords.push(p.shapeCoords);

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

// ===================================================
// 🧩 Realtime batching API
// ===================================================

window.beginRealtimeUpdate = function() {
  if (mapManager) mapManager.clearBuses();
  if (deck3d) deck3d.reset();
  window.__realtimeUpdatesBuffer = [];
};

window.applyRealtimeUpdate = function(u) {
  if (!u || !u.routeId) return;

  const routeId = u.routeId;
  const staticData = staticDataStore.get(routeId);
  if (!staticData) {
    console.warn(`No static data for route ${routeId}`);
    return;
  }

  const color = getVariedColor(staticData.meta.operatorColor || "#1976d2", String(routeId));

  const card = routeCards.get(routeId);
  if (card) card.update(u);

  if (deck3d && deck3dConfig && deck3dConfig.enabled) {
    deck3d.setRouteVehicles(routeId, u.vehicles || [], color);
  } else {
    if (u.vehicles && u.vehicles.length && busMarkers) {
      busMarkers.drawBuses(u.vehicles, color, staticData.shapeCoords);
    }
  }

  if (Array.isArray(window.__realtimeUpdatesBuffer)) window.__realtimeUpdatesBuffer.push(u);
};

window.endRealtimeUpdate = function() {
  const updates = Array.isArray(window.__realtimeUpdatesBuffer) ? window.__realtimeUpdatesBuffer : [];
  if (nearbyPanel) nearbyPanel.updateTimes(updates);
  console.log("✅ Realtime batch updated");
};

// תאימות לאחור
window.updateRealtimeData = function(updates) {
  if (!Array.isArray(updates)) return;
  console.log("🔄 Updating realtime data:", updates.length, "routes");
  window.beginRealtimeUpdate();
  updates.forEach(u => window.applyRealtimeUpdate(u));
  window.endRealtimeUpdate();
};

console.log("📱 KavNav Client Script Loaded");