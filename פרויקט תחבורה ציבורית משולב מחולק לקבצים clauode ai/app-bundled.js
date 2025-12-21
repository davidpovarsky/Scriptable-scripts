// web/app-bundled.js
// גרסה מאוחדת ללא ES6 modules - עובדת ב-Scriptable WebView

(function() {
  'use strict';

  // ============================================
  // MapManager
  // ============================================
  class MapManager {
    constructor() {
      this.map = null;
      this.busLayerGroup = null;
      this.userLocationMarker = null;
      this.didInitialFit = false;
    }

    init(elementId = 'map') {
      this.map = L.map(elementId, { zoomControl: false })
        .setView([32.08, 34.78], 13);
      
      L.control.zoom({ position: 'topright' }).addTo(this.map);
      
      L.tileLayer("https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: ""
      }).addTo(this.map);
      
      this.busLayerGroup = L.layerGroup().addTo(this.map);
      this.busLayerGroup.setZIndex(1000);

      return this.map;
    }

    setUserLocation(lat, lon) {
      if (!this.map) return;
      
      if (this.userLocationMarker) {
        this.userLocationMarker.remove();
      }
      
      this.userLocationMarker = L.circleMarker([lat, lon], { 
        radius: 8,
        color: "#1976d2", 
        fillColor: "#2196f3",
        fillOpacity: 0.6 
      }).addTo(this.map);
    }

    centerOnUser() {
      if (this.userLocationMarker && this.map) {
        this.map.setView(this.userLocationMarker.getLatLng(), 16);
      }
    }

    clearBuses() {
      if (this.busLayerGroup) {
        this.busLayerGroup.clearLayers();
      }
    }

    drawRoutePolyline(shapeCoords, color) {
      if (!this.map || !shapeCoords || !shapeCoords.length) return;
      
      const latLngs = shapeCoords.map(c => [c[1], c[0]]);
      
      L.polyline(latLngs, {
        color: color,
        weight: 4,
        opacity: 0.6,
        smoothFactor: 1
      }).addTo(this.map);
    }

    fitBoundsToShapes(allShapeCoords) {
      if (!this.map || !allShapeCoords || !allShapeCoords.length) return;
      if (this.didInitialFit) return;

      const allPoints = [];
      allShapeCoords.forEach(coords => {
        if (Array.isArray(coords)) {
          coords.forEach(c => {
            if (Array.isArray(c) && c.length === 2) {
              allPoints.push([c[1], c[0]]);
            }
          });
        }
      });

      if (allPoints.length > 1) {
        const bounds = L.latLngBounds(allPoints);
        this.map.fitBounds(bounds, { padding: [50, 50] });
        this.didInitialFit = true;
      }
    }

    invalidateSize() {
      if (this.map) {
        this.map.invalidateSize();
      }
    }

    getMap() {
      return this.map;
    }

    getBusLayerGroup() {
      return this.busLayerGroup;
    }
  }

  // ============================================
  // BusMarkers
  // ============================================
  class BusMarkers {
    constructor(busLayerGroup) {
      this.busLayerGroup = busLayerGroup;
    }

    drawBuses(vehicles, color, shapeCoords) {
      if (!this.busLayerGroup) return;

      const shapeLatLngs = shapeCoords ? shapeCoords.map(c => [c[1], c[0]]) : [];
      
      vehicles.forEach(v => {
        let lat = v.lat;
        let lon = v.lon;
        
        if ((!lat || !lon) && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
          const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
          const point = shapeLatLngs[idx];
          if (point) {
            lat = point[0];
            lon = point[1];
          }
        }
        
        if (lat && lon) {
          const bearing = v.bearing || 0;
          const iconHtml = this._createBusIconHtml(bearing, color, v.routeNumber);
          
          L.marker([lat, lon], {
            icon: L.divIcon({
              html: iconHtml,
              className: "",
              iconSize: [34, 34],
              iconAnchor: [17, 17]
            }),
            zIndexOffset: 1000
          }).addTo(this.busLayerGroup);
        }
      });
    }

    _createBusIconHtml(bearing, color, routeNumber) {
      return `
        <div class="bus-marker-container">
          <div class="bus-direction-arrow" style="transform: rotate(${bearing}deg);">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="${color}" stroke="white" stroke-width="2">
              <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
            </svg>
          </div>
          <div class="main-bus-icon" style="background:${color};">
            <span class="material-symbols-outlined">directions_bus</span>
          </div>
          ${routeNumber ? `<div class="route-badge" style="color:${color}; border-color:${color};">${routeNumber}</div>` : ''}
        </div>
      `;
    }
  }

  // ============================================
  // UserLocationManager
  // ============================================
  class UserLocationManager {
    constructor(mapManager) {
      this.mapManager = mapManager;
      this.isLocal = window.APP_ENVIRONMENT === 'local';
    }

    async getUserLocation() {
      if (this.isLocal) {
        return new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
          }
          navigator.geolocation.getCurrentPosition(
            position => resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }),
            error => reject(error),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
      } else {
        return null;
      }
    }

    setupLocateButton() {
      const locateBtn = document.getElementById('locateMeBtn');
      if (!locateBtn) return;

      locateBtn.addEventListener('click', async () => {
        const originalIcon = locateBtn.textContent;
        locateBtn.textContent = '⏳';
        
        try {
          const location = await this.getUserLocation();
          
          if (location) {
            console.log("Updated location:", location);
            this.mapManager.setUserLocation(location.latitude, location.longitude);
            this.mapManager.centerOnUser();
          } else {
            this.mapManager.centerOnUser();
          }
        } catch (e) {
          console.log("Could not refresh location, using last known:", e);
          this.mapManager.centerOnUser();
        } finally {
          setTimeout(() => {
            locateBtn.textContent = originalIcon;
          }, 500);
        }
      });
    }
  }

  // ============================================
  // NearbyPanel
  // ============================================
  class NearbyPanel {
    constructor() {
      this.stopsData = [];
    }

    init(stops) {
      if (!Array.isArray(stops)) return;
      this.stopsData = stops;
      this.render();
    }

    render() {
      const container = document.getElementById('nearbyStopsList');
      if (!container) return;
      
      container.innerHTML = '';

      if (this.stopsData.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">לא נמצאו תחנות קרובות</div>';
        return;
      }

      this.stopsData.forEach((stop, index) => {
        const bubble = this._createStopBubble(stop, index === 0);
        container.appendChild(bubble);
      });
    }

    _createStopBubble(stop, isActive = false) {
      const div = document.createElement('div');
      div.className = `stop-bubble ${isActive ? 'active' : ''}`;
      div.id = `bubble-${stop.stopCode}`;
      div.onclick = (e) => this._toggleBubble(div, e);

      div.innerHTML = `
        <div class="sb-header">
          <div style="flex:1;">
            <div class="sb-name">${stop.stopName}</div>
            <div class="sb-meta">
              <span>קוד: ${stop.stopCode}</span>
            </div>
          </div>
        </div>
        <div class="sb-times" id="times-${stop.stopCode}">
          <div style="padding:10px 0; text-align:center; color:#999; font-size:12px;">ממתין לנתונים...</div>
        </div>
      `;
      
      return div;
    }

    _toggleBubble(el, event) {
      document.querySelectorAll('.stop-bubble').forEach(b => {
        if (b !== el) b.classList.remove('active');
      });
      
      el.classList.toggle('active');
      
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 300);
    }

    updateTimes(updates) {
      const arrivalsByStop = new Map();

      updates.forEach(u => {
        if (!u.vehicles) return;
        
        u.vehicles.forEach(v => {
          if (!v.onwardCalls) return;
          
          v.onwardCalls.forEach(call => {
            const sc = String(call.stopCode);
            const stopContainer = document.getElementById(`times-${sc}`);
            
            if (stopContainer) {
              if (!arrivalsByStop.has(sc)) {
                arrivalsByStop.set(sc, []);
              }
              
              const etaDate = new Date(call.eta);
              const minutes = Math.round((etaDate - new Date()) / 60000);
              
              if (minutes >= -1) {
                arrivalsByStop.get(sc).push({
                  line: v.routeNumber,
                  dest: v.headsign,
                  min: minutes,
                  eta: call.eta
                });
              }
            }
          });
        });
      });

      arrivalsByStop.forEach((arrivals, stopCode) => {
        const container = document.getElementById(`times-${stopCode}`);
        if (!container) return;

        arrivals.sort((a, b) => a.min - b.min);
        
        const html = topBuses.slice(0, 10).map(item => {
  const timeText = item.min <= 0 ? 'כעת' : `${item.min} דק'`;
  const etaTime = item.eta.split('T')[1].substring(0, 5);
  return `
    <div class="sb-row">
      <div style="display:flex; align-items:center; gap:8px; flex:1; overflow:hidden;">
        <span class="sb-route-badge">${item.line}</span>
        <span class="sb-dest">${item.dest}</span>
      </div>
      <div style="text-align:left;">
        <div class="sb-eta">${timeText}</div>
        <div style="font-size:10px; color:#aaa;">${etaTime}</div>
      </div>
    </div>`;
}).join('');

        container.innerHTML = html || '<div style="padding:10px; text-align:center; color:#999; font-size:12px;">אין הגעות בזמן הקרוב</div>';
      });
    }

    getStopsData() {
      return this.stopsData;
    }
  }

  // ============================================
  // BottomSheet
  // ============================================
  class BottomSheet {
    constructor() {
      this.startY = 0;
      this.startH = 0;
    }

    init() {
      const sheet = document.getElementById('bottomSheet');
      if (!sheet) return;
      
      const handle = document.getElementById('dragHandleArea');
      if (!handle) return;

      handle.addEventListener('touchstart', (e) => {
        this.startY = e.touches[0].clientY;
        this.startH = sheet.offsetHeight;
        sheet.style.transition = 'none';
      });

      document.addEventListener('touchmove', (e) => {
        if (!this.startY) return;
        
        const delta = this.startY - e.touches[0].clientY;
        let h = this.startH + delta;
        h = Math.max(60, Math.min(window.innerHeight * 0.9, h));
        sheet.style.height = h + "px";
      });

      document.addEventListener('touchend', () => {
        this.startY = 0;
        sheet.style.transition = 'height 0.3s ease';
        
        const h = sheet.offsetHeight;
        if (h < 150) {
          sheet.style.height = "60px";
        } else if (h > window.innerHeight * 0.6) {
          sheet.style.height = "85vh";
        } else {
          sheet.style.height = "45vh";
        }
      });
    }
  }

  // ============================================
  // RouteCard
  // ============================================
  class RouteCard {
    constructor(routeId, meta, stops, color) {
      this.routeId = routeId;
      this.meta = meta;
      this.stops = stops;
      this.color = color;
      this.cardElement = null;
      this.lastUpdateSpan = null;
      this.stopsList = null;
      this.rowsContainer = null;
    }

    create() {
      const container = document.getElementById("routesContainer");
      if (!container) return;

      const card = document.createElement("div");
      card.className = "route-card";

      const header = this._createHeader();
      const stopsList = this._createStopsList();
      
      card.append(header, stopsList);
      container.appendChild(card);
      
      this.cardElement = card;
      this.lastUpdateSpan = header.querySelector(".last-update-text");
      this.stopsList = stopsList;
      this.rowsContainer = stopsList.querySelector(".stops-rows");

      return card;
    }

    _createHeader() {
      const header = document.createElement("header");
      header.style.background = this.color;
      header.innerHTML = `
        <div class="line-main">
          <div>
            <span class="route-number">${this.meta.routeNumber || this.meta.routeCode}</span>
            <span class="headsign">${this.meta.headsign}</span>
          </div>
          <div style="font-size:12px; opacity:0.9">קו ${this.meta.routeCode}</div>
        </div>
        <div class="sub">
          <span>${this.meta.routeDate || ""}</span>
          <span class="last-update-text">ממתין לעדכון...</span>
        </div>
      `;
      return header;
    }

    _createStopsList() {
      const stopsList = document.createElement("div");
      stopsList.className = "stops-list";
      
      const rowsContainer = document.createElement("div");
      rowsContainer.className = "stops-rows";
      
      this.stops.forEach((stop, idx) => {
        const row = this._createStopRow(stop, idx);
        rowsContainer.appendChild(row);
      });
      
      stopsList.appendChild(rowsContainer);
      return stopsList;
    }

    _createStopRow(stop, idx) {
      const row = document.createElement("div");
      row.className = "stop-row";
      
      const isFirst = idx === 0;
      const isLast = idx === this.stops.length - 1;
      
      const timeline = document.createElement("div");
      timeline.className = `timeline${isFirst ? ' first' : ''}${isLast ? ' last' : ''}`;
      timeline.innerHTML = `
        <div class="timeline-line line-top"></div>
        <div class="timeline-circle" style="border-color:${this.color}"></div>
        <div class="timeline-line line-bottom"></div>
      `;
      
      const main = document.createElement("div");
      main.className = "stop-main";
      main.innerHTML = `
        <div class="stop-name">
          <span class="seq-num" style="color:${this.color}">${idx + 1}.</span>
          <span>${stop.stopName}</span>
        </div>
        <div class="stop-code">${stop.stopCode || ""}</div>
        <div class="stop-buses" id="buses-${this.routeId}-${stop.stopCode}"></div>
      `;
      
      row.append(timeline, main);
      return row;
    }

    update(updateData) {
      if (!this.lastUpdateSpan || !this.stopsList) return;

      const meta = updateData.meta || {};
      const snap = meta.lastSnapshot || meta.lastVehicleReport || new Date().toISOString();
      const timeStr = snap.split("T")[1]?.split(".")[0] || snap;
      this.lastUpdateSpan.textContent = "עדכון: " + timeStr;

      this._updateStopTimes(updateData);
      this._updateTimelineIcons(updateData);
    }

    _updateStopTimes(updateData) {
      const busesByStop = new Map();
      const now = new Date();
      
      (updateData.vehicles || []).forEach(v => {
        if (!v.onwardCalls) return;
        
        v.onwardCalls.forEach(c => {
          if (!c.stopCode || !c.eta) return;
          
          const minutes = Math.round((new Date(c.eta) - now) / 60000);
          if (minutes < -1) return;
          
          const sc = String(c.stopCode);
          if (!busesByStop.has(sc)) {
            busesByStop.set(sc, []);
          }
          busesByStop.get(sc).push(minutes);
        });
      });

      this.stops.forEach(stop => {
        const container = document.getElementById(`buses-${this.routeId}-${stop.stopCode}`);
        if (!container) return;
        
        const times = busesByStop.get(String(stop.stopCode));
        if (times && times.length) {
          times.sort((a, b) => a - b);
          container.innerHTML = times.slice(0, 3).map(m => {
            let cls = "bus-late";
            let txt = m + " דק׳";
            
            if (m <= 0) {
              txt = "כעת";
              cls = "bus-soon";
            } else if (m <= 5) {
              cls = "bus-soon";
            } else if (m <= 10) {
              cls = "bus-mid";
            } else if (m <= 20) {
              cls = "bus-far";
            }
            
            return `<div class="bus-chip ${cls}">${txt}</div>`;
          }).join("");
        } else {
          container.innerHTML = "";
        }
      });
    }

    _updateTimelineIcons(updateData) {
      this.stopsList.querySelectorAll(".bus-icon-timeline").forEach(e => e.remove());
      
      const listHeight = this.rowsContainer.offsetHeight;
      if (listHeight < 50) return;

      (updateData.vehicles || []).forEach(v => {
        const pos = v.positionOnLine;
        if (typeof pos !== "number") return;
        
        let top = pos * listHeight;
        if (top < 10) top = 10;
        if (top > listHeight - 20) top = listHeight - 20;
        
        const icon = document.createElement("div");
        icon.className = "bus-icon-timeline material-symbols-outlined";
        icon.textContent = "directions_bus";
        icon.style.color = this.color;
        icon.style.top = top + "px";
        
        this.stopsList.appendChild(icon);
      });
    }

    getElement() {
      return this.cardElement;
    }
  }

  // ============================================
  // ModeToggle
  // ============================================
  class ModeToggle {
    constructor(mapManager) {
      this.mapManager = mapManager;
    }

    init() {
      const radios = document.getElementsByName('viewMode');
      
      radios.forEach(r => {
        r.addEventListener('change', (e) => {
          const isDual = e.target.value === 'dual';
          
          if (isDual) {
            document.body.classList.add('mode-dual');
            document.body.classList.remove('mode-map-only');
          } else {
            document.body.classList.add('mode-map-only');
            document.body.classList.remove('mode-dual');
          }
          
          setTimeout(() => {
            if (this.mapManager) {
              this.mapManager.invalidateSize();
            }
          }, 450);
        });
      });
    }
  }

  // ============================================
  // Utils
  // ============================================
  function getVariedColor(hex, strSalt) {
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    
    let r = parseInt(c.substring(0, 2), 16);
    let g = parseInt(c.substring(2, 4), 16);
    let b = parseInt(c.substring(4, 6), 16);
    
    let hash = 0;
    for (let i = 0; i < strSalt.length; i++) {
      hash = strSalt.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const v = (hash % 60) - 30;
    const clamp = n => Math.min(255, Math.max(0, Math.round(n + v)));
    
    return "#" + [clamp(r), clamp(g), clamp(b)]
      .map(x => x.toString(16).padStart(2, '0'))
      .join("");
  }

  // ============================================
  // Main App
  // ============================================
  let mapManager = null;
  let busMarkers = null;
  let userLocationManager = null;
  let nearbyPanel = null;
  let bottomSheet = null;
  let modeToggle = null;

  const staticDataStore = new Map();
  const routeCards = new Map();

  document.addEventListener('DOMContentLoaded', async function() {
    console.log("🚀 KavNav App Starting...");

    mapManager = new MapManager();
    mapManager.init('map');

    busMarkers = new BusMarkers(mapManager.getBusLayerGroup());
    userLocationManager = new UserLocationManager(mapManager);
    nearbyPanel = new NearbyPanel();
    bottomSheet = new BottomSheet();
    modeToggle = new ModeToggle(mapManager);

    bottomSheet.init();
    modeToggle.init();
    userLocationManager.setupLocateButton();

    console.log("✅ All managers initialized");
  });

  // Global functions for Scriptable
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
      
      // ציור הקו של המסלול על המפה
      if (mapManager && p.shapeCoords && p.shapeCoords.length) {
        mapManager.drawRoutePolyline(p.shapeCoords, color);
      }
      
      const card = new RouteCard(routeId, p.meta, p.stops, color);
      card.create();
      routeCards.set(routeId, card);
    });

    if (mapManager && allShapeCoords.length) {
      mapManager.fitBoundsToShapes(allShapeCoords);
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

  console.log("📱 KavNav Client Script Loaded");
// מצב פיתוח local
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
// ציור נקודות תחנות
if (p.stops) {
  p.stops.forEach(s => {
    if (s.lat && s.lon) {
      L.circleMarker([s.lat, s.lon], { 
        radius: 3, 
        weight: 1, 
        color: "#666", 
        fillColor: "#fff", 
        fillOpacity: 1 
      })
      .bindTooltip(s.stopName, { direction: "top", offset: [0, -4] })
      .addTo(mapManager.getMap());
    }
  });
}
    // 5. התחלת רענון זמן אמת
    startRealtimeLoop(routesStatic, API_BASE);

  } catch (e) {
    console.error("Local mode init error:", e);
  }
}

// לולאת רענון זמן אמת (ל-Local)
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

  // רענון ראשוני
  await update();

  // רענון כל 10 שניות
  setInterval(update, 10000);
}

// קריאה ל-initLocalMode במצב local
const IS_LOCAL = window.APP_ENVIRONMENT === 'local';
if (IS_LOCAL) {
  document.addEventListener('DOMContentLoaded', async function() {
    await initLocalMode();
  });
}
})();