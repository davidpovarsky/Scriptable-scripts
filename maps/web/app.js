// web/app.js
// נקודת הכניסה הראשית - KavNav GLB Edition

// ============================================
// משתנים גלובליים
// ============================================
let mapManager = null;
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
  console.log("🚀 KavNav GLB App Starting...");

  try {
    // אתחול רכיבי UI שאינם תלויי מפה
    // אנו מניחים שהמחלקות האלו קיימות בקבצים האחרים שלא שונו
    if (typeof NearbyPanel !== 'undefined') nearbyPanel = new NearbyPanel();
    if (typeof BottomSheet !== 'undefined') {
        bottomSheet = new BottomSheet();
        bottomSheet.init();
    }
    if (typeof ModeToggle !== 'undefined') modeToggle = new ModeToggle(null);
    
    console.log("✅ UI components initialized");

    if (!window.MAPBOX_TOKEN || window.MAPBOX_TOKEN.includes('YOUR_')) {
      console.error("❌ No Mapbox token configured!");
      return;
    }

    // אתחול מפה
    mapManager = new MapManager();
    const map = mapManager.init('map', window.MAPBOX_TOKEN);

    map.on('load', () => {
      console.log("🗺️ Mapbox loaded successfully!");
      mapIsFullyLoaded = true;
      
      // אתחול רכיבים תלויי מפה
      if (typeof UserLocationManager !== 'undefined') {
          userLocationManager = new UserLocationManager(mapManager);
          userLocationManager.setupLocateButton();
      }
      
      if (modeToggle) {
        modeToggle.mapManager = mapManager;
        modeToggle.init();
      }
      setup3DToggle();

      // עיבוד מידע שהמתין לטעינה
      if (pendingStaticData) {
        processStaticData(pendingStaticData);
        pendingStaticData = null;
      }

      if (pendingRealtimeData.length > 0) {
        pendingRealtimeData.forEach(data => processRealtimeData(data));
        pendingRealtimeData = [];
      }
    });

  } catch (e) {
    console.error("❌ Init error:", e);
  }
};

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
  if (!Array.isArray(payloads) || !mapManager) return;
  
  const allShapeCoords = [];

  payloads.forEach(p => {
    const routeId = p.meta.routeId;
    staticDataStore.set(routeId, p);

    if (p.shapeCoords && p.shapeCoords.length) {
      allShapeCoords.push(p.shapeCoords);
    }

    const color = p.meta.operatorColor || "#1976d2";
    
    // ציור מסלול
    try {
      mapManager.drawRoutePolyline(p.shapeCoords, color, routeId);
    } catch (e) {
      console.error(`Error drawing route ${routeId}:`, e);
    }
    
    // יצירת כרטיס
    if (typeof RouteCard !== 'undefined') {
        const card = new RouteCard(routeId, p.meta, p.stops, color);
        card.create();
        routeCards.set(routeId, card);
    }
  });

  if (allShapeCoords.length) {
    mapManager.fitBoundsToShapes(allShapeCoords);
  }
}

// ============================================
// Process Realtime Data
// ============================================
function processRealtimeData(updates) {
  if (!Array.isArray(updates) || !mapManager) return;

  const busLayer = mapManager.getBusLayer();
  
  // מערך שטוח לכל הרכבים מכל הקווים
  let allVehiclesFlat = [];
  
  updates.forEach(u => {
    const routeId = u.routeId;
    const staticData = staticDataStore.get(routeId);
    const shapeCoords = staticData ? staticData.shapeCoords : null;

    // עדכון כרטיס
    const card = routeCards.get(routeId);
    if (card) card.update(u);

    // איסוף רכבים
    if (u.vehicles && u.vehicles.length) {
        u.vehicles.forEach(v => {
            // אם חסר מיקום, ננסה לחשב לפי positionOnLine כאן או בשכבה
            // נעביר את המידע כמו שהוא, השכבה תטפל ב-fallback
            
            // הוספת צבע
            v.color = staticData ? (staticData.meta.operatorColor || '#ffffff') : '#ffffff';
            
            // האק: אם חסר לו מיקום אבל יש לו positionOnLine ויש לנו shapeCoords
            // נחשב את זה כאן כדי לחסוך עבודה לשכבה, או נעביר את ה-shapeCoords לשכבה?
            // הפתרון שבחרנו ב-BusMarkers הוא לקבל shapeCoords.
            // אבל כאן יש לנו הרבה קווים שונים.
            // לכן: נחשב כאן את הקואורדינטות אם חסרות, ונשלח ל-Layer רק קואורדינטות נקיות.
            
            if ((!v.lat || !v.lon) && typeof v.positionOnLine === 'number' && shapeCoords) {
                const idx = Math.floor(v.positionOnLine * (shapeCoords.length - 1));
                if (shapeCoords[idx]) {
                    v.lon = shapeCoords[idx][0];
                    v.lat = shapeCoords[idx][1];
                }
            }
            
            if (v.lat && v.lon) {
                allVehiclesFlat.push(v);
            }
        });
    }
  });

  // עדכון השכבה התלת מימדית
  if (busLayer) {
      busLayer.updateVehicles(allVehiclesFlat);
  }

  // עדכון פאנל קרוב
  if (nearbyPanel) {
    nearbyPanel.updateTimes(updates);
  }
}

// ============================================
// Global Interface
// ============================================
window.initNearbyStops = function(stops) {
  if (nearbyPanel) nearbyPanel.init(stops);
};

window.setUserLocation = function(lat, lon) {
  if (mapManager && mapIsFullyLoaded) {
    mapManager.setUserLocation(lat, lon);
  } else if (mapManager && mapManager.getMap()) {
    mapManager.getMap().once('load', () => mapManager.setUserLocation(lat, lon));
  }
};

window.initStaticData = function(payloads) {
  if (mapIsFullyLoaded) processStaticData(payloads);
  else pendingStaticData = payloads;
};

window.updateRealtimeData = function(updates) {
  if (mapIsFullyLoaded && staticDataStore.size > 0) processRealtimeData(updates);
  else pendingRealtimeData.push(updates);
};

console.log("📱 KavNav GLB Client Script Loaded");
