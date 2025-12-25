// web/app.js
// נקודת הכניסה הראשית - גרסת Mapbox

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
let pendingStaticData = null;
let pendingRealtimeData = [];

// ============================================
// אתחול ראשוני
// ============================================
const initApp = async function() {
  console.log("🚀 KavNav Mapbox App Starting...");

  try {
    // Initialize ALL components immediately (not dependent on map)
    nearbyPanel = new NearbyPanel();
    bottomSheet = new BottomSheet();
    modeToggle = new ModeToggle(null); // Will set mapManager later
    
    bottomSheet.init();
    
    console.log("✅ UI components initialized");

    // Check for Mapbox token
    if (!window.MAPBOX_TOKEN || window.MAPBOX_TOKEN === 'YOUR_MAPBOX_ACCESS_TOKEN_HERE') {
      console.error("❌ No Mapbox token configured!");
      alert("שגיאה: לא הוגדר Mapbox API key\n\nערוך את view.js והוסף את ה-token שלך");
      return;
    }

    // Initialize map with token
    mapManager = new MapManager();
    const map = mapManager.init('map', window.MAPBOX_TOKEN);

    // Wait for map to fully load
    map.on('load', () => {
      console.log("🗺️ Mapbox loaded successfully!");
      
      // Now initialize map-dependent components
      busMarkers = new BusMarkers(mapManager);
      userLocationManager = new UserLocationManager(mapManager);
      
      // Update modeToggle with mapManager
      if (modeToggle) {
        modeToggle.mapManager = mapManager;
      }
      modeToggle.init();
      userLocationManager.setupLocateButton();
      setup3DToggle();

      console.log("✅ Map-dependent components initialized");

      // Process any pending data immediately
      if (pendingStaticData) {
        console.log("📦 Processing pending static data...");
        processStaticData(pendingStaticData);
        pendingStaticData = null;
      }

      if (pendingRealtimeData.length > 0) {
        console.log("🔄 Processing pending realtime data...");
        pendingRealtimeData.forEach(data => processRealtimeData(data));
        pendingRealtimeData = [];
      }
    });
    
    // Fallback: process pending data after 5 seconds if map load didn't trigger
    setTimeout(() => {
      if (pendingStaticData) {
        console.log("⏰ Timeout: Processing pending static data");
        processStaticData(pendingStaticData);
        pendingStaticData = null;
      }
      if (pendingRealtimeData.length > 0) {
        console.log("⏰ Timeout: Processing pending realtime data");
        pendingRealtimeData.forEach(data => processRealtimeData(data));
        pendingRealtimeData = [];
      }
    }, 5000);

    map.on('error', (e) => {
      console.error("❌ Mapbox error:", e);
      if (e.error && e.error.message) {
        if (e.error.message.includes('401')) {
          alert("שגיאה: Mapbox API key לא תקין\n\nבדוק את ה-token ב-view.js");
        }
      }
    });

  } catch (e) {
    console.error("❌ Init error:", e);
    alert("שגיאה באתחול: " + e.message);
  }
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
// Process Static Data
// ============================================
function processStaticData(payloads) {
  if (!Array.isArray(payloads)) return;
  
  const allShapeCoords = [];

  payloads.forEach(p => {
    const routeId = p.meta.routeId;
    staticDataStore.set(routeId, p);

    if (p.shapeCoords && p.shapeCoords.length) {
      allShapeCoords.push(p.shapeCoords);
    }

    const color = getVariedColor(p.meta.operatorColor || "#1976d2", String(routeId));
    
    // Draw route polyline
    if (mapManager) {
      try {
        mapManager.drawRoutePolyline(p.shapeCoords, color, routeId);
      } catch (e) {
        console.error("Error drawing route:", e);
      }
    }
    
    // Create route card
    const card = new RouteCard(routeId, p.meta, p.stops, color);
    card.create();
    routeCards.set(routeId, card);
  });

  // Fit bounds to all routes
  if (mapManager && allShapeCoords.length) {
    try {
      mapManager.fitBoundsToShapes(allShapeCoords);
    } catch (e) {
      console.error("Error fitting bounds:", e);
    }
  }

  console.log("✅ Static data processed:", payloads.length, "routes");
}

// ============================================
// Process Realtime Data
// ============================================
function processRealtimeData(updates) {
  if (!Array.isArray(updates)) return;

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

    // Update route card
    const card = routeCards.get(routeId);
    if (card) {
      card.update(u);
    }

    // Draw buses
    if (u.vehicles && u.vehicles.length && busMarkers) {
      try {
        busMarkers.drawBuses(u.vehicles, color, staticData.shapeCoords);
      } catch (e) {
        console.error("Error drawing buses:", e);
      }
    }
  });

  // Update nearby panel
  if (nearbyPanel) {
    nearbyPanel.updateTimes(updates);
  }

  console.log("✅ Realtime updated:", updates.length, "routes");
}

// ============================================
// פונקציות גלובליות לשימוש Scriptable
// ============================================

window.initNearbyStops = function(stops) {
  if (!Array.isArray(stops)) return;
  console.log("📍 Initializing nearby stops:", stops.length);
  
  if (nearbyPanel) {
    nearbyPanel.init(stops);
  } else {
    console.log("⚠️ nearbyPanel not ready yet");
  }
};

window.setUserLocation = function(lat, lon) {
  console.log("👤 Setting user location:", lat, lon);
  
  if (mapManager && mapManager.getMap() && mapManager.getMap().loaded()) {
    mapManager.setUserLocation(lat, lon);
  } else {
    console.log("⏳ Map not ready, will set location when loaded");
    if (mapManager && mapManager.getMap()) {
      mapManager.getMap().once('load', () => {
        mapManager.setUserLocation(lat, lon);
      });
    }
  }
};

window.initStaticData = function(payloads) {
  if (!Array.isArray(payloads)) return;
  console.log("📦 Receiving static data:", payloads.length, "routes");

  // Check if map is ready - need to check both map exists AND is loaded
  const mapReady = mapManager && 
                   mapManager.getMap() && 
                   mapManager.getMap().loaded && 
                   mapManager.getMap().loaded();
  
  if (mapReady) {
    console.log("📦 Map ready, processing immediately");
    processStaticData(payloads);
  } else {
    console.log("⏳ Map not ready, queueing static data");
    pendingStaticData = payloads;
  }
};

window.updateRealtimeData = function(updates) {
  if (!Array.isArray(updates)) return;
  console.log("🔄 Receiving realtime data:", updates.length, "routes");

  // Check if map is ready
  const mapReady = mapManager && 
                   mapManager.getMap() && 
                   mapManager.getMap().loaded && 
                   mapManager.getMap().loaded();
  
  if (mapReady) {
    processRealtimeData(updates);
  } else {
    console.log("⏳ Map not ready, queueing realtime data");
    pendingRealtimeData.push(updates);
  }
};

console.log("📱 KavNav Mapbox Client Script Loaded");