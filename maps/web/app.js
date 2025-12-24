// web/app.js
// Runs inside WebView (browser-like) and drives UI

let mapManager;
let busMarkers;
let userLocation;
let nearbyPanel;
let bottomSheet;
let modeToggle;

const staticDataStore = new Map();
const routeCards = new Map();

window.startKavNavApp = async function() {
  console.log("🚀 KavNav App Starting.....");

  mapManager = new MapManager();
  mapManager.init('map');

  busMarkers = new BusMarkers(mapManager);
  userLocation = new UserLocation(mapManager);
  nearbyPanel = new NearbyPanel();
  bottomSheet = new BottomSheet();
  modeToggle = new ModeToggle(mapManager);

  // locate me button
  const locateBtn = document.getElementById("locateMeBtn");
  if (locateBtn) {
    locateBtn.addEventListener("click", () => userLocation.centerOnUser());
  }

  console.log("✅ App ready. Waiting for data...");
};

window.receiveDataFromScriptable = function(payload) {
  try {
    console.log("📦 Received data:", payload);

    // payload.routes: array of { meta, shapeCoords, stops, ... }
    if (payload && payload.routes && payload.routes.length) {
      initializeStaticData(payload.routes);
    }

    // payload.realtime: array of realtime updates per routeId
    if (payload && payload.realtime && payload.realtime.length) {
      updateRealtimeData(payload.realtime);
    }

    if (payload && payload.nearbyStops) {
      nearbyPanel.updateStops(payload.nearbyStops);
    }
  } catch (e) {
    console.error("❌ receiveDataFromScriptable error:", e);
  }
};

function initializeStaticData(routePayloads) {
  console.log("🧩 Initializing static data:", routePayloads.length);

  routePayloads.forEach(p => {
    const routeId = p.meta.routeId;
    staticDataStore.set(routeId, p);

    const color = getVariedColor(p.meta.operatorColor || "#1976d2", String(routeId));

    // draw route polyline
    if (mapManager && p.shapeCoords && p.shapeCoords.length) {
      mapManager.drawRoutePolyline(routeId, p.shapeCoords, color);
    }

    // create card
    const card = new RouteCard(p.meta, color);
    routeCards.set(routeId, card);
    bottomSheet.addCard(card);
  });

  // initial fit
  if (mapManager) {
    const shapes = routePayloads.map(p => p.shapeCoords).filter(Boolean);
    mapManager.fitBoundsToShapes(shapes);
  }
}

function updateRealtimeData(updates) {
  console.log("🟢 Realtime updates:", updates.length);

  if (mapManager) {
    mapManager.clearBuses();
  }

  const computeVehiclePosition = (v, shapeCoords) => {
    let lat = v && v.lat;
    let lon = v && v.lon;

    // אם אין מיקום מדויק, נשתמש ב-positionOnLine
    if ((!lat || !lon) && v && typeof v.positionOnLine === "number" && Array.isArray(shapeCoords) && shapeCoords.length > 1) {
      const idx = Math.floor(v.positionOnLine * (shapeCoords.length - 1));
      const point = shapeCoords[idx];
      if (Array.isArray(point) && point.length >= 2) {
        lon = point[0];
        lat = point[1];
      }
    }

    if (typeof lat !== "number" || typeof lon !== "number") return null;
    return { lat, lon };
  };

  const allBuses = [];

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

    // נאסוף את כל האוטובוסים לכל המסלולים — deck.gl צריך Layer אחד (אחרת תדרוס את עצמו)
    if (u.vehicles && u.vehicles.length) {
      const shapeCoords = staticData.shapeCoords || [];
      u.vehicles.forEach((v, i) => {
        const pos = computeVehiclePosition(v, shapeCoords);
        if (!pos) return;

        allBuses.push({
          id: `${routeId}:${v.id || v.vehicleId || v.license || v.plate || i}`,
          lon: pos.lon,
          lat: pos.lat,
          bearing: Number(v.bearing) || 0,
          routeNumber: staticData.meta.routeNumber || v.routeNumber || "",
          color
        });
      });
    }
  });

  if (busMarkers) {
    busMarkers.setBuses(allBuses);
  }

  if (nearbyPanel) {
    nearbyPanel.updateTimes(updates);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.APP_ENVIRONMENT !== 'scriptable') {
    window.startKavNavApp();
  }
});