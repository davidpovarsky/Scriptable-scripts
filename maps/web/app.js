// web/app.js
// נקודת הכניסה הראשית - גרסה תלת-מימדית משופרת

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
  console.log("Environment:", window.APP_ENVIRONMENT);
  
  // Check if maplibregl is loaded
  if (typeof maplibregl === 'undefined') {
    console.error('❌ MapLibre GL JS not loaded!');
    const mapDiv = document.getElementById('map');
    if (mapDiv) {
      mapDiv.innerHTML = '<div style="padding:20px; text-align:center; color:red; background:white;">שגיאה: ספריית המפות לא נטענה<br>בדוק חיבור אינטרנט</div>';
    }
    return;
  }
  
  console.log('✅ MapLibre GL JS loaded, version:', maplibregl.version);

  try {
    // Initialize map manager
    mapManager = new MapManager();
    const map = mapManager.init('map');
    
    if (!map) {
      console.error('❌ Map initialization failed');
      return;
    }
    
    console.log('✅ Map manager initialized');

    // Wait for map to load before creating other managers
    map.on('load', () => {
      console.log("🗺️ Map loaded, initializing components...");
      
      try {
        busMarkers = new BusMarkers(mapManager);
        console.log('✅ Bus markers initialized');
        
        userLocationManager = new UserLocationManager(mapManager);
        console.log('✅ User location manager initialized');
        
        nearbyPanel = new NearbyPanel();
        console.log('✅ Nearby panel initialized');
        
        bottomSheet = new BottomSheet();
        bottomSheet.init();
        console.log('✅ Bottom sheet initialized');
        
        modeToggle = new ModeToggle(mapManager);
        modeToggle.init();
        console.log('✅ Mode toggle initialized');
        
        userLocationManager.setupLocateButton();
        console.log('✅ Locate button setup');
        
        // Setup 3D toggle button
        setup3DToggle();
        console.log('✅ 3D toggle setup');

        console.log("✅ All managers initialized successfully!");
        
      } catch (e) {
        console.error('❌ Error initializing components:', e);
        alert('שגיאה באתחול רכיבים: ' + e.message);
      }
    });
    
    map.on('error', (e) => {
      console.error('❌ Map error:', e);
    });
    
  } catch (e) {
    console.error('❌ Fatal error in initApp:', e);
    alert('שגיאה קריטית: ' + e.message);
  }
};

// ============================================
// 3D Toggle Setup
// ============================================
function setup3DToggle() {
  const toggle3DBtn = document.getElementById('toggle3DBtn');
  if (!toggle3DBtn) {
    console.warn('⚠️ 3D toggle button not found');
    return;
  }
  
  if (!mapManager) {
    console.warn('⚠️ Map manager not available for 3D toggle');
    return;
  }

  toggle3DBtn.addEventListener('click', () => {
    console.log('3D toggle clicked');
    try {
      mapManager.toggle3D();
      toggle3DBtn.classList.toggle('active');
    } catch (e) {
      console.error('Failed to toggle 3D:', e);
    }
  });
  
  console.log('✅ 3D toggle button configured');
}

// ============================================
// פונקציות גלובליות לשימוש Scriptable
// ============================================

window.initNearbyStops = function(stops) {
  if (!Array.isArray(stops)) {
    console.warn('Invalid stops data');
    return;
  }
  
  console.log("📍 Initializing nearby stops:", stops.length);
  
  try {
    if (nearbyPanel) {
      nearbyPanel.init(stops);
      console.log('✅ Nearby stops initialized');
    } else {
      console.warn('⚠️ Nearby panel not ready yet');
    }
  } catch (e) {
    console.error('Failed to initialize nearby stops:', e);
  }
};

window.setUserLocation = function(lat, lon) {
  console.log("👤 Setting user location:", lat, lon);
  
  try {
    if (mapManager) {
      mapManager.setUserLocation(lat, lon);
      console.log('✅ User location set');
    } else {
      console.warn('⚠️ Map manager not ready yet');
    }
  } catch (e) {
    console.error('Failed to set user location:', e);
  }
};

window.initStaticData = function(payloads) {
  if (!Array.isArray(payloads)) {
    console.warn('Invalid static data');
    return;
  }
  
  console.log("📦 Receiving static data:", payloads.length, "routes");

  const allShapeCoords = [];

  payloads.forEach((p, index) => {
    try {
      const routeId = p.meta.routeId;
      console.log(`Processing route ${index + 1}/${payloads.length}: ${routeId}`);
      
      staticDataStore.set(routeId, p);

      if (p.shapeCoords && p.shapeCoords.length) {
        allShapeCoords.push(p.shapeCoords);
      }

      const color = getVariedColor(p.meta.operatorColor || "#1976d2", String(routeId));
      
      if (mapManager && p.shapeCoords && p.shapeCoords.length) {
        const map = mapManager.getMap();
        
        if (map && map.loaded()) {
          mapManager.drawRoutePolyline(p.shapeCoords, color, routeId);
        } else if (map) {
          map.on('load', () => {
            mapManager.drawRoutePolyline(p.shapeCoords, color, routeId);
          });
        }
      }
      
      const card = new RouteCard(routeId, p.meta, p.stops, color);
      card.create();
      routeCards.set(routeId, card);
      
    } catch (e) {
      console.error(`Failed to process route ${p.meta?.routeId}:`, e);
    }
  });

  if (mapManager && allShapeCoords.length) {
    try {
      const map = mapManager.getMap();
      
      if (map && map.loaded()) {
        mapManager.fitBoundsToShapes(allShapeCoords);
      } else if (map) {
        map.on('load', () => {
          mapManager.fitBoundsToShapes(allShapeCoords);
        });
      }
    } catch (e) {
      console.error('Failed to fit bounds:', e);
    }
  }

  console.log("✅ Static data initialized - routes:", payloads.length, "cards:", routeCards.size);
};

window.updateRealtimeData = function(updates) {
  if (!Array.isArray(updates)) {
    console.warn('Invalid realtime data');
    return;
  }
  
  console.log("🔄 Updating realtime data:", updates.length, "routes");

  try {
    if (mapManager) {
      mapManager.clearBuses();
    }

    updates.forEach((u, index) => {
      try {
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
        
      } catch (e) {
        console.error(`Failed to update route ${u.routeId}:`, e);
      }
    });

    if (nearbyPanel) {
      nearbyPanel.updateTimes(updates);
    }

    console.log("✅ Realtime data updated");
    
  } catch (e) {
    console.error('Failed to update realtime data:', e);
  }
};

console.log("📱 KavNav 3D Client Script Loaded");
console.log("Waiting for DOM...");