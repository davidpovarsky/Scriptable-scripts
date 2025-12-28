// web/app.js
// נקודת הכניסה הראשית - גרסת Mapbox המתוקנת עם animation loop

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
let mapIsFullyLoaded = false;

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
      mapIsFullyLoaded = true;
      
      // Now initialize map-dependent components
      busMarkers = new BusMarkers(mapManager);
      userLocationManager = new UserLocationManager(mapManager);
      
      // 🔥 חשוב! התחל את ה-animation loop
      busMarkers.animate();
      console.log("🎬 Bus animation loop started");
      
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
        console.log("📦 Processing pending static data from queue...");
        processStaticData(pendingStaticData);
        pendingStaticData = null;
      }

      if (pendingRealtimeData.length > 0) {
        console.log("🔄 Processing pending realtime data from queue...");
        pendingRealtimeData.forEach(data => processRealtimeData(data));
        pendingRealtimeData = [];
      }
    });
    
    // Fallback: process pending data after 5 seconds if map load didn't trigger
    setTimeout(() => {
      if (pendingStaticData) {
        console.log("⏰ Timeout: Processing pending static data (fallback)");
        mapIsFullyLoaded = true;
        processStaticData(pendingStaticData);
        pendingStaticData = null;
      }
      if (pendingRealtimeData.length > 0) {
        console.log("⏰ Timeout: Processing pending realtime data (fallback)");
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
  if (!Array.isArray(payloads)) {
    console.warn("⚠️ Invalid payloads for static data");
    return;
  }
  
  console.log("🔧 Processing static data for", payloads.length, "routes");
  
  const allShapeCoords = [];

  payloads.forEach(p => {
    const routeId = p.meta.routeId;
    
    console.log(`  📍 Route ${routeId}: ${p.meta.routeNumber || 'N/A'} - ${p.meta.headsign || 'N/A'}`);
    
    staticDataStore.set(routeId, p);

    if (p.shapeCoords && p.shapeCoords.length) {
      allShapeCoords.push(p.shapeCoords);
    }

    const color = getVariedColor(p.meta.operatorColor || "#1976d2", String(routeId));
    
    // Draw route polyline
    if (mapManager && mapIsFullyLoaded) {
      try {
        mapManager.drawRoutePolyline(p.shapeCoords, color, routeId);
      } catch (e) {
        console.error(`  ❌ Error drawing route ${routeId}:`, e);
      }
    }
    
    // Create route card
    try {
      const card = new RouteCard(routeId, p.meta, p.stops, color);
      card.create();
      routeCards.set(routeId, card);
    } catch (e) {
      console.error(`  ❌ Error creating card for route ${routeId}:`, e);
    }
  });

  // Fit bounds to all routes
  if (mapManager && mapIsFullyLoaded && allShapeCoords.length) {
    try {
      mapManager.fitBoundsToShapes(allShapeCoords);
    } catch (e) {
      console.error("  ❌ Error fitting bounds:", e);
    }
  }

  console.log("✅ Static data processed:", payloads.length, "routes");
}

// ============================================
// Process Realtime Data - FIXED
// ============================================
function processRealtimeData(updates) {
  if (!Array.isArray(updates)) {
    console.warn("⚠️ Invalid updates for realtime data");
    return;
  }

  // Set לאיסוף כל הרכבים הפעילים בכל הקווים בעדכון הנוכחי
  const activeVehicleIds = new Set();
  let processedCount = 0;

  updates.forEach(u => {
    const routeId = u.routeId;
    const staticData = staticDataStore.get(routeId);
    
    if (!staticData) {
      // אם אין מידע סטטי, לא נוכל לצייר, אבל לא נשבור את הלולאה
      return;
    }

    const color = getVariedColor(staticData.meta.operatorColor || "#1976d2", String(routeId));

    // Update route card
    const card = routeCards.get(routeId);
    if (card) {
      try {
        card.update(u);
        processedCount++;
      } catch (e) {
        console.error(`❌ Error updating card for route ${routeId}:`, e);
      }
    }

    // Draw buses & collect IDs
    if (u.vehicles && u.vehicles.length && busMarkers) {
      try {
        // איסוף ה-IDs של הרכבים בקו הזה
        u.vehicles.forEach(v => {
           if(v.lat && v.lon) {
              const vId = v.vehicleId || `${v.routeNumber}-${v.tripId || ''}`;
              activeVehicleIds.add(vId);
           }
        });
        
        // ציור/עדכון (מבלי למחוק אחרים)
        busMarkers.drawBuses(u.vehicles, color, staticData.shapeCoords);
      } catch (e) {
        console.error(`❌ Error drawing buses for route ${routeId}:`, e);
      }
    }
  });

  // כעת, כשיש לנו את כל הרכבים הפעילים מכל הקווים, ננקה את השאר
  if (busMarkers) {
    busMarkers.pruneMarkers(activeVehicleIds);
  }

  // Update nearby panel
  if (nearbyPanel) {
    try {
      nearbyPanel.updateTimes(updates);
    } catch (e) {
      console.error("❌ Error updating nearby panel:", e);
    }
  }

  console.log(`✅ Realtime updated: ${processedCount} routes processed`);
}

// ============================================
// פונקציות עזר
// ============================================

function getVariedColor(baseColor, seed) {
  if (!baseColor) return "#1976d2";
  
  // If seed is provided, vary the color slightly for visual distinction
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash;
    }
    
    let r, g, b;
    if (baseColor.startsWith('#')) {
      const hex = baseColor.substring(1);
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (baseColor.startsWith('rgb')) {
      const matches = baseColor.match(/\d+/g);
      if (matches && matches.length >= 3) {
        r = parseInt(matches[0]);
        g = parseInt(matches[1]);
        b = parseInt(matches[2]);
      } else {
        return baseColor;
      }
    } else {
      return baseColor;
    }
    
    // Apply slight variation (±10%)
    const variation = (hash % 21) - 10;
    r = Math.max(0, Math.min(255, r + variation));
    g = Math.max(0, Math.min(255, g + variation));
    b = Math.max(0, Math.min(255, b + variation));
    
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  return baseColor;
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
  console.log("🔍 mapManager exists?", !!mapManager);
  console.log("🔍 mapIsFullyLoaded?", mapIsFullyLoaded);
  
  if (mapManager && mapIsFullyLoaded) {
    console.log("✅ Calling mapManager.setUserLocation");
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
  if (!Array.isArray(payloads)) {
    console.warn("⚠️ Invalid static data received");
    return;
  }
  console.log("📦 Receiving static data:", payloads.length, "routes");

  if (mapIsFullyLoaded) {
    console.log("📦 Map ready, processing immediately");
    processStaticData(payloads);
  } else {
    console.log("⏳ Map not ready, queueing static data");
    pendingStaticData = payloads;
  }
};

window.updateRealtimeData = function(updates) {
  if (!Array.isArray(updates)) {
    console.warn("⚠️ Invalid realtime data received");
    return;
  }
  console.log("🔄 Receiving realtime data:", updates.length, "routes");

  if (mapIsFullyLoaded && staticDataStore.size > 0) {
    processRealtimeData(updates);
  } else {
    console.log("⏳ Map or static data not ready, queueing realtime data");
    pendingRealtimeData.push(updates);
  }
};

// Debug helper - קריאה מהקונסול
window.getBusStats = function() {
  if (busMarkers) {
    const stats = busMarkers.getStats();
    console.log("📊 Bus Statistics:", stats);
    return stats;
  }
  return null;
};

console.log("📱 KavNav Mapbox Client Script Loaded");