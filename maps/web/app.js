// web/app.js
// נקודת הכניסה הראשית - גרסה תלת-מימדית

// ============================================
// משתנים גלובליים
// ============================================
let mapManager = null;
let busMarkers = null;
let userLocationManager = null;
let nearbyPanel = null;
let bottomSheet = null;
let modeToggle = null;

const staticDataStore = new Map();
const routeCards = new Map();

// ============================================
// אתחול ראשוני
// ============================================
const initApp = async function() {
  console.log("🚀 KavNav 3D App Starting...");

  mapManager = new MapManager();
  mapManager.init('map');

  // Wait for map to load before creating other managers
  mapManager.getMap().on('load', () => {
    console.log("🗺️ Map loaded, initializing components...");
    
    busMarkers = new BusMarkers(mapManager);
    userLocationManager = new UserLocationManager(mapManager);
    nearbyPanel = new NearbyPanel();
    bottomSheet = new BottomSheet();
    modeToggle = new ModeToggle(mapManager);

    bottomSheet.init();
    modeToggle.init();
    userLocationManager.setupLocateButton();
    
    // Setup 3D toggle button
    setup3DToggle();

    console.log("✅ All managers initialized");
  });
};

// ============================================
// 3D Toggle Setup
// ============================================
function setup3DToggle() {
  const toggle3DBtn = document.getElementById('toggle3DBtn');
  if (!toggle3DBtn || !mapManager) return;

  toggle3DBtn.addEventListener('click', () => {
    mapManager.toggle3D();
    toggle3DBtn.classList.toggle('active');
  });
}

// ============================================
// פונקציות גלובליות לשימוש Scriptable
// ============================================

window.initNearbyStops = function(stops) {
  if (!Array.isArray(stops)) return;
  console.log("📍 Initializing nearby stops:", stops.length);
  
  if (nearbyPanel) {
    nearbyPanel.init(stops);
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
      // Draw route on map once it's loaded
      if (mapManager.getMap().loaded()) {
        mapManager.drawRoutePolyline(p.shapeCoords, color, routeId);
      } else {
        mapManager.getMap().on('load', () => {
          mapManager.drawRoutePolyline(p.shapeCoords, color, routeId);
        });
      }
    }
    
    const card = new RouteCard(routeId, p.meta, p.stops, color);
    card.create();
    routeCards.set(routeId, card);
  });

  if (mapManager && allShapeCoords.length) {
    // Fit bounds once map is loaded
    if (mapManager.getMap().loaded()) {
      mapManager.fitBoundsToShapes(allShapeCoords);
    } else {
      mapManager.getMap().on('load', () => {
        mapManager.fitBoundsToShapes(allShapeCoords);
      });
    }
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

  if (nearbyPanel) {
    nearbyPanel.updateTimes(updates);
  }

  console.log("✅ Realtime data updated");
};

console.log("📱 KavNav 3D Client Script Loaded");
