// web/app.js
// Main application logic - Mapbox 3D version

let mapManager;
let userLocation;
let busMarkers;
let bottomSheet;
let nearbyPanel;
let modeToggle;

const routeCards = new Map();
const staticDataStore = new Map();

// Config
const REFRESH_INTERVAL = 15000; // 15 seconds
let currentMode = 'full'; // full, map, stops

// Initialize app
function initApp() {
  console.log("🚀 Initializing KavNav app (Mapbox 3D)...");
  
  try {
    // Initialize map
    mapManager = new MapManager();
    const map = mapManager.init('map', window.MAPBOX_TOKEN);
    
    // Initialize user location
    userLocation = new UserLocation(mapManager);
    
    // Initialize bus markers
    busMarkers = new BusMarkers(mapManager);
    
    // Initialize bottom sheet
    bottomSheet = new BottomSheet();
    
    // Initialize nearby panel
    nearbyPanel = new NearbyPanel();
    
    // Initialize mode toggle
    modeToggle = new ModeToggle((mode) => {
      currentMode = mode;
      updateLayout();
    });
    
    // Setup UI events
    setupUIEvents();
    
    // Load initial data and start refresh
    loadInitialData();
    
    console.log("✅ App initialized successfully");
  } catch (e) {
    console.error("❌ Error initializing app:", e);
    if (typeof showError === 'function') {
      showError(e, 'initApp');
    }
  }
}

function setupUIEvents() {
  // Locate me button
  const locateBtn = document.getElementById('locateMeBtn');
  if (locateBtn) {
    locateBtn.onclick = async () => {
      try {
        const loc = await userLocation.requestLocation();
        if (loc) {
          mapManager.flyToLocation(loc.lon, loc.lat);
          nearbyPanel.setUserLocation(loc);
        }
      } catch (e) {
        console.error("❌ Error locating user:", e);
      }
    };
  }
  
  // Toggle 3D button
  const toggle3DBtn = document.getElementById('toggle3DBtn');
  if (toggle3DBtn) {
    toggle3DBtn.onclick = () => {
      const enabled = mapManager.toggle3D();
      toggle3DBtn.classList.toggle('active', enabled);
    };
  }
}

function updateLayout() {
  const mapPane = document.getElementById('mapPane');
  const routesPane = document.getElementById('routesPane');
  const stopsPane = document.getElementById('stopsPane');
  
  if (!mapPane || !routesPane || !stopsPane) return;
  
  // Reset classes
  mapPane.classList.remove('hidden');
  routesPane.classList.remove('hidden');
  stopsPane.classList.remove('hidden');
  
  switch (currentMode) {
    case 'map':
      routesPane.classList.add('hidden');
      stopsPane.classList.add('hidden');
      break;
    case 'stops':
      mapPane.classList.add('hidden');
      routesPane.classList.add('hidden');
      break;
    case 'full':
    default:
      // Show all
      break;
  }
}

async function loadInitialData() {
  try {
    console.log("📥 Loading initial routes...");
    
    // Fetch routes list (example - adapt to your API)
    const routesResponse = await fetchJsonWithCacheBuster('https://kavnav.com/api/routes?nearby=1');
    if (!routesResponse || !Array.isArray(routesResponse.routes)) {
      console.warn("⚠️ No routes data received");
      return;
    }
    
    // Create route cards and store static data
    routesResponse.routes.forEach(route => {
      try {
        const card = new RouteCard(route, bottomSheet);
        routeCards.set(route.routeId, card);
        
        // Store static route data
        staticDataStore.set(route.routeId, {
          meta: route,
          shapeCoords: route.shapeCoords || []
        });
        
        // Draw route on map
        if (route.shapeCoords && route.shapeCoords.length) {
          const color = getVariedColor(route.operatorColor || "#1976d2", String(route.routeId));
          mapManager.drawRoute(route.routeId, route.shapeCoords, color);
        }
      } catch (e) {
        console.error(`❌ Error creating route card for ${route.routeId}:`, e);
      }
    });
    
    // Fit map to all routes
    const allCoords = [];
    staticDataStore.forEach(data => {
      if (data.shapeCoords) allCoords.push(...data.shapeCoords);
    });
    if (allCoords.length) {
      mapManager.fitToPoints(allCoords);
    }
    
    // Start realtime updates
    startRealtimeUpdates();
    
    console.log("✅ Initial data loaded");
  } catch (e) {
    console.error("❌ Error loading initial data:", e);
  }
}

function startRealtimeUpdates() {
  console.log(`🔄 Starting realtime updates every ${REFRESH_INTERVAL/1000}s...`);
  
  // Initial update
  updateRealtimeData();
  
  // Schedule updates
  setInterval(updateRealtimeData, REFRESH_INTERVAL);
}

async function updateRealtimeData() {
  try {
    console.log("🔄 Fetching realtime data...");
    
    // Collect route IDs
    const routeIds = Array.from(staticDataStore.keys());
    if (!routeIds.length) return;
    
    // Fetch realtime updates for all routes
    const updates = await fetchJsonWithCacheBuster(`https://kavnav.com/api/realtime?routeIds=${routeIds.join(',')}`);
    
    // Process updates
    processRealtimeData(updates);
    
  } catch (e) {
    console.error("❌ Error updating realtime data:", e);
  }
}

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

    // Draw buses (GLB layer) & collect IDs from what was actually drawn
    if (u.vehicles && u.vehicles.length && busMarkers) {
      try {
        const drawnIds = busMarkers.drawBuses(u.vehicles, color, staticData.shapeCoords);
        if (drawnIds && typeof drawnIds.forEach === 'function') {
          drawnIds.forEach(id => activeVehicleIds.add(id));
        }
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

  console.log(`✅ Realtime updated: ${processedCount}/${updates.length} routes`);
}

// Helper: fetch JSON with cache buster
async function fetchJsonWithCacheBuster(url) {
  try {
    const cacheBuster = `cb=${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const separator = url.includes('?') ? '&' : '?';
    const finalUrl = url + separator + cacheBuster;
    
    const resp = await fetch(finalUrl);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} for ${url}`);
    }
    return await resp.json();
  } catch (e) {
    console.error("❌ fetchJson error:", e);
    return null;
  }
}

// Expose initApp globally
window.initApp = initApp;