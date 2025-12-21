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

// משתנים גלובליים
let mapManager = null;
let busMarkers = null;
let userLocationManager = null;
let nearbyPanel = null;
let bottomSheet = null;
let modeToggle = null;

const staticDataStore = new Map();
const routeCards = new Map();

// --- אתחול ---
document.addEventListener('DOMContentLoaded', async function() {
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
});

// --- פונקציות שנקראות מ-Scriptable ---

/**
 * מקבל נתוני תחנות קרובות ומאתחל את הפאנל
 */
window.initNearbyStops = function(stops) {
  if (!Array.isArray(stops)) return;
  console.log("📍 Initializing nearby stops:", stops.length);
  
  if (nearbyPanel) {
    nearbyPanel.init(stops);
  }
};

/**
 * קובע מיקום משתמש על המפה
 */
window.setUserLocation = function(lat, lon) {
  if (!mapManager) return;
  console.log("👤 Setting user location:", lat, lon);
  mapManager.setUserLocation(lat, lon);
};

/**
 * מקבל נתונים סטטיים (מסלולים, תחנות, shapes) - קורה פעם אחת
 */
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

    // יצירת כרטיס מסלול
    const color = getVariedColor(p.meta.operatorColor || "#1976d2", String(routeId));
    const card = new RouteCard(routeId, p.meta, p.stops, color);
    card.create();
    routeCards.set(routeId, card);
  });

  // התאמת המפה לכל המסלולים
  if (mapManager && allShapeCoords.length) {
    mapManager.fitBoundsToShapes(allShapeCoords);
  }

  console.log("✅ Static data initialized");
};

/**
 * מעדכן נתוני זמן אמת (רכבים) - קורה כל X שניות
 */
window.updateRealtimeData = function(updates) {
  if (!Array.isArray(updates)) return;
  console.log("🔄 Updating realtime data:", updates.length, "routes");

  // ניקוי אוטובוסים קודמים
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

    // עדכון כרטיס
    const card = routeCards.get(routeId);
    if (card) {
      card.update(u);
    }

    // ציור אוטובוסים על המפה
    if (u.vehicles && u.vehicles.length && busMarkers) {
      busMarkers.drawBuses(u.vehicles, color, staticData.shapeCoords);
    }
  });

  // עדכון הפאנל הצדדי
  if (nearbyPanel) {
    nearbyPanel.updateTimes(updates);
  }

  console.log("✅ Realtime data updated");
};

console.log("📱 KavNav Client Script Loaded");
