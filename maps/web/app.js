// web/app.js
// נקודת הכניסה הראשית בצד הלקוח

import { MapManager } from '../modules/map/mapManager.js';
import { BusMarkers } from '../modules/map/busMarkers.js';
import { UserLocationManager } from '../modules/map/userLocation.js';
import { NearbyPanel } from '../modules/stops/nearbyPanel.js';
import { BottomSheet } from '../modules/routes/bottomSheet.js';
import { RouteCard } from '../modules/routes/routeCard.js';
import { ModeToggle } from '../modules/ui/modeToggle.js';
import { getVariedColor } from '../modules/ui/utils.js';

// משתנים גלובליים// web/app.js
// נקודת הכניסה הראשית בצד הלקוח - מתוקן למודולים!

// משתנים גלובליים (מוגדרים מיד!)
let mapManager = null;
let busMarkers = null;
let userLocationManager = null;
let nearbyPanel = null;
let bottomSheet = null;
let modeToggle = null;

const staticDataStore = new Map();
const routeCards = new Map();

// ===================================
// פונקציות window (מוגדרות מיד!)
// ===================================

/**
 * מקבל נתוני תחנות קרובות ומאתחל את הפאנל
 */
window.initNearbyStops = function(stops) {
  if (!Array.isArray(stops)) return;
  console.log("📍 Initializing nearby stops:", stops.length);
  
  if (nearbyPanel) {
    nearbyPanel.init(stops);
  } else {
    console.warn("⚠️ nearbyPanel not ready yet, waiting...");
    setTimeout(() => window.initNearbyStops(stops), 100);
  }
};

/**
 * קובע מיקום משתמש על המפה
 */
window.setUserLocation = function(lat, lon) {
  if (!mapManager) {
    console.warn("⚠️ mapManager not ready yet, waiting...");
    setTimeout(() => window.setUserLocation(lat, lon), 100);
    return;
  }
  console.log("👤 Setting user location:", lat, lon);
  mapManager.setUserLocation(lat, lon);
};

/**
 * מקבל נתונים סטטיים (מסלולים, תחנות, shapes) - קורה פעם אחת
 */
window.initStaticData = function(payloads) {
  if (!Array.isArray(payloads)) return;
  console.log("📦 Receiving static data:", payloads.length, "routes");

  if (!mapManager) {
    console.warn("⚠️ mapManager not ready yet, waiting...");
    setTimeout(() => window.initStaticData(payloads), 100);
    return;
  }

  const allShapeCoords = [];

  payloads.forEach(p => {
    const routeId = p.meta.routeId;
    staticDataStore.set(routeId, p);

    if (p.shapeCoords && p.shapeCoords.length) {
      allShapeCoords.push(p.shapeCoords);
    }

    const color = getVariedColor(p.meta.operatorColor || "#1976d2", String(routeId));
    
    // ציור הקו של המסלול
    if (mapManager && p.shapeCoords && p.shapeCoords.length) {
      mapManager.drawRoutePolyline(p.shapeCoords, color);
    }
    
    const card = new RouteCard(routeId, p.meta, p.stops, color);
    card.create();
    routeCards.set(routeId, card);
  });

  // התאמת המפה לכל המסלולים
  if (allShapeCoords.length && mapManager) {
    mapManager.fitAllShapes(allShapeCoords);
  }

  console.log("✅ Static data initialized");
};

/**
 * מקבל עדכוני זמן אמת
 */
window.updateRealtimeData = function(updates) {
  if (!Array.isArray(updates)) return;
  console.log("🔄 Realtime update:", updates.length, "routes");

  if (!busMarkers || !nearbyPanel) {
    console.warn("⚠️ Managers not ready yet");
    return;
  }

  nearbyPanel.updateTimes(updates);

  updates.forEach(u => {
    const staticData = staticDataStore.get(u.routeId);
    if (!staticData) return;

    const vehicles = u.vehicles || [];
    busMarkers.updateBuses(u.routeId, vehicles, staticData.shapeCoords);

    const card = routeCards.get(u.routeId);
    if (card) {
      card.update(vehicles);
    }
  });
};

// ===================================
// אתחול (רץ כש-DOM מוכן)
// ===================================

const initApp = async function() {
  console.log("🚀 KavNav App Starting...");

  // יצירת מנהלי המערכת
  mapManager = new MapManager();
  mapManager.init('map');

  busMarkers = new BusMarkers(mapManager.getBusLayerGroup());
  userLocationManager = new UserLocationManager(mapManager);
  nearbyPanel = new NearbyPanel();
  bottomSheet = new BottomSheet();
  modeToggle = new ModeToggle(mapManager);

  // אתחול רכיבי UI
  bottomSheet.init();
  modeToggle.init();
  userLocationManager.setupLocateButton();

  console.log("✅ All managers initialized");
};

// הרץ מיד אם DOM כבר טעון, אחרת חכה
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  console.log("📋 DOM already loaded, running immediately");
  initApp();
}