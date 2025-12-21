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
    
    // ציור הקו של המסלול על המפה
    if (mapManager && p.shapeCoords && p.shapeCoords.length) {
      mapManager.drawRoutePolyline(p.shapeCoords, color);
    }
    // 🆕 ציור נקודות תחנות
  if (mapManager && p.stops) {
    mapManager.drawStopMarkers(p.stops, mapManager.getMap());
  }
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
// ============================================
// מצב פיתוח Local (לדפדפן)
// ============================================

async function initLocalMode() {
  try {
    // 1. קבלת מיקום משתמש
    let userLat = null, userLon = null;
    try {
      const location = await getUserLocation();
      if (location) {
        userLat = location.latitude;
        userLon = location.longitude;
        window.setUserLocation(userLat, userLon);
      }
    } catch (e) {
      console.log("Location failed, using fallback:", e);
    }

    // 2. טעינת תחנות קרובות או ברירת מחדל
    const DEFAULT_ROUTES = [
      { routeId: 30794 },
      { routeId: 18086 }
    ];
    
    let ROUTES = DEFAULT_ROUTES;
    const API_BASE = "https://kavnav.com/api";
    const routeDate = new Date().toISOString().split('T')[0];

    // 3. טעינת נתונים סטטיים
    const routesStatic = [];
    for (const cfg of ROUTES) {
      try {
        const url = `${API_BASE}/route?routeId=${cfg.routeId}&date=${routeDate}`;
        const routeData = await fetchJson(url);
        
        const routeIdStr = String(cfg.routeId);
        let routeMeta = null;
        if (Array.isArray(routeData.routes)) {
          routeMeta = routeData.routes.find(r => String(r.routeId) === routeIdStr) || routeData.routes[0];
        }

        const routeChanges = (routeData.routeChanges && routeData.routeChanges[routeIdStr]) || [];
        const currentChange = routeChanges.find(c => c.isCurrent) || routeChanges[0];
        
        if (!currentChange) continue;

        const routeObj = {
          routeId: cfg.routeId,
          routeDate,
          routeMeta,
          routeCode: routeMeta?.code,
          headsign: currentChange.headsign || routeMeta?.routeLongName || "",
          routeStops: (currentChange.stoptimes || []).map(st => ({
            stopId: String(st.stopId || ""),
            stopSequence: st.stopSequence,
            stopCode: st.stopCode || null,
            stopName: st.stopName || "(ללא שם)",
            lat: st.lat || null,
            lon: st.lon || null
          })).sort((a, b) => (a.stopSequence || 0) - (b.stopSequence || 0)),
          operatorColor: "#1976d2",
          shapeId: currentChange.shapeId,
          shapeCoords: null
        };

        // טעינת shape
        if (routeObj.shapeId) {
          try {
            const shapeUrl = `${API_BASE}/shapes?shapeIds=${routeObj.shapeId}`;
            const shapesData = await fetchJson(shapeUrl);
            const coords = shapesData[routeObj.shapeId] || Object.values(shapesData)[0];
            if (coords && Array.isArray(coords)) {
              routeObj.shapeCoords = coords;
            }
          } catch (e) {
            console.error("Shape fetch error:", e);
          }
        }

        routesStatic.push(routeObj);
      } catch (e) {
        console.error(`Error fetching route ${cfg.routeId}:`, e);
      }
    }

    // 4. הצגת נתונים סטטיים
    const staticPayload = routesStatic.map(r => ({
      meta: {
        routeId: r.routeId,
        routeCode: r.routeCode,
        operatorColor: r.operatorColor,
        headsign: r.headsign,
        routeNumber: r.routeMeta?.routeNumber,
        routeDate: r.routeDate
      },
      stops: r.routeStops,
      shapeCoords: r.shapeCoords
    }));

    window.initStaticData(staticPayload);

    // 5. התחלת רענון זמן אמת
    startRealtimeLoop(routesStatic, API_BASE);

  } catch (e) {
    console.error("Local mode init error:", e);
  }
}

async function startRealtimeLoop(routesStatic, API_BASE) {
  async function update() {
    try {
      const allPayloads = [];

      for (const r of routesStatic) {
        try {
          const realtimeUrl = `${API_BASE}/realtime?routeCode=${encodeURIComponent(r.routeCode)}`;
          const realtimeData = await fetchJson(realtimeUrl);

          const vehiclesRaw = Array.isArray(realtimeData.vehicles) ? realtimeData.vehicles : [];
          const relevantVehicles = vehiclesRaw.filter(v =>
            v.trip && String(v.trip.routeId) === String(r.routeId)
          );

          const slimVehicles = relevantVehicles.map(v => {
            const trip = v.trip || {};
            const onwardCalls = trip.onwardCalls || {};
            const calls = Array.isArray(onwardCalls.calls) ? onwardCalls.calls : [];
            const gtfs = trip.gtfsInfo || {};
            const pos = v.geo?.positionOnLine?.positionOnLine ?? null;
            const loc = v.geo && v.geo.location ? v.geo.location : {};

            return {
              vehicleId: v.vehicleId,
              lastReported: v.lastReported,
              routeNumber: gtfs.routeNumber,
              headsign: gtfs.headsign,
              bearing: v.bearing || v.geo?.bearing || 0,
              lat: (typeof loc.lat === "number") ? loc.lat : null,
              lon: (typeof loc.lon === "number") ? loc.lon : null,
              positionOnLine: typeof pos === "number" ? pos : null,
              onwardCalls: calls.map(c => ({
                stopCode: c.stopCode,
                eta: c.eta
              }))
            };
          });

          allPayloads.push({
            routeId: r.routeId,
            meta: {
              routeId: r.routeId,
              routeCode: r.routeCode,
              lastSnapshot: realtimeData.lastSnapshot
            },
            vehicles: slimVehicles
          });

        } catch (e) {
          console.error("RT Error:", e);
        }
      }

      window.updateRealtimeData(allPayloads);

    } catch (e) {
      console.error("Realtime update error:", e);
    }
  }

  await update();
  setInterval(update, 10000);
}

// קריאה אוטומטית במצב Local
const IS_LOCAL = window.APP_ENVIRONMENT === 'local';
if (IS_LOCAL) {
  document.addEventListener('DOMContentLoaded', async function() {
    await initLocalMode();
  });
}