// web/app.js - לוגיקה משולבת לדפדפן

// ===== STATE =====
let mapInstance = null;
let busLayerGroup = null;
let userLocationMarker = null;
let staticDataStore = new Map();
let routeViews = new Map();
let mapDidInitialFit = false;

// Stations state
let STOPS = [];
let DATA = {};
let currentStopCode = null;
let searchTimeout = null;

// ===== HELPERS =====
function notify(cmd) {
  window.location = "unified://" + cmd;
}

// ===== MODE SWITCHING =====
document.addEventListener('DOMContentLoaded', function() {
  initMap();
  initStations();
  initModeSwitcher();
  initBottomSheet();
});

function initModeSwitcher() {
  const container = document.getElementById('unified-container');
  const buttons = document.querySelectorAll('.mode-btn');
  
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      
      // עדכון UI
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // החלפת class
      container.className = `mode-${mode}`;
      
      // התאמת מפה
      if (mapInstance && (mode === 'map' || mode === 'both')) {
        setTimeout(() => mapInstance.invalidateSize(), 100);
      }
      
      // עדכון backend
      notify(`setViewMode/${mode}`);
    });
  });
  
  // מסכים קטנים - הצגת שני כפתורים בלבד
  if (window.innerWidth <= 768) {
    const bothBtn = document.querySelector('[data-mode="both"]');
    if (bothBtn) bothBtn.style.display = 'none';
  }
}

// ===== MAP LOGIC =====
function initMap() {
  mapInstance = L.map("map", { zoomControl: false }).setView([32.08, 34.78], 13);
  L.control.zoom({ position: 'topright' }).addTo(mapInstance);
  L.tileLayer("https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: ""
  }).addTo(mapInstance);
  
  busLayerGroup = L.layerGroup().addTo(mapInstance);
  busLayerGroup.setZIndex(1000);

  const locateBtn = document.getElementById('locateMeBtn');
  if (locateBtn) {
    locateBtn.addEventListener('click', centerOnUser);
  }
}

window.initStaticData = function(payloads) {
  if (!Array.isArray(payloads)) return;
  
  const allLatLngs = [];

  payloads.forEach(p => {
    const routeId = String(p.meta.routeId);
    staticDataStore.set(routeId, p);
    
    const baseColor = p.meta.operatorColor || "#1976d2";
    const color = getVariedColor(baseColor, routeId);
    
    // צייר קו מסלול
    if (p.shapeCoords && p.shapeCoords.length) {
      const latLngs = p.shapeCoords.map(c => [c[1], c[0]]);
      const polyline = L.polyline(latLngs, { 
        weight: 4, 
        opacity: 0.8, 
        color: color,
        className: `route-line route-${routeId}`
      }).addTo(mapInstance);
      
      polyline._routeId = routeId; // שמירת ID
      
      latLngs.forEach(ll => allLatLngs.push(ll));
    }

    // צייר תחנות
    if (p.stops) {
      p.stops.forEach(s => {
        if (s.lat && s.lon) {
          const marker = L.circleMarker([s.lat, s.lon], { 
            radius: 3, weight: 1, color: "#666", 
            fillColor: "#fff", fillOpacity: 1,
            className: `stop-marker stop-${s.stopCode}`
          })
          .bindTooltip(s.stopName, { direction: "top", offset: [0, -4] })
          .addTo(mapInstance);
          
          marker._stopCode = s.stopCode;
        }
      });
    }

    // בנה כרטיס HTML
    createRouteCard(routeId, p.meta, p.stops, color);
  });

  // התמקדות ראשונית
  if (allLatLngs.length && !mapDidInitialFit) {
    mapInstance.fitBounds(allLatLngs, { padding: [30, 30] });
    mapDidInitialFit = true;
  }
};

window.updateRealtimeData = function(updates) {
  if (!busLayerGroup) return;
  busLayerGroup.clearLayers();

  updates.forEach(u => {
    const routeId = String(u.routeId);
    const staticData = staticDataStore.get(routeId);
    if (!staticData) return;

    const color = getVariedColor(staticData.meta.operatorColor || "#1976d2", routeId);
    updateCardData(routeId, u, staticData.stops, color);

    if (u.vehicles && u.vehicles.length) {
      drawBuses(u.vehicles, color, staticData.shapeCoords, routeId);
    }
  });
};

function drawBuses(vehicles, color, shapeCoords, routeId) {
  const shapeLatLngs = shapeCoords ? shapeCoords.map(c => [c[1], c[0]]) : [];

  vehicles.forEach(v => {
    let lat = v.lat;
    let lon = v.lon;

    if ((!lat || !lon) && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
      const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
      const point = shapeLatLngs[idx];
      if (point) { lat = point[0]; lon = point[1]; }
    }

    if (lat && lon) {
      const bearing = v.bearing || 0;
      const iconHtml = `
        <div class="bus-marker-container" data-route-id="${routeId}">
            <div class="bus-direction-arrow" style="transform: rotate(${bearing}deg);">
               <svg viewBox="0 0 24 24" width="24" height="24" fill="${color}" stroke="white" stroke-width="2">
                  <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
               </svg>
            </div>
            <div class="main-bus-icon" style="background:${color};">
                <span class="material-symbols-outlined">directions_bus</span>
            </div>
            ${v.routeNumber ? `<div class="route-badge" style="color:${color}; border-color:${color};">${v.routeNumber}</div>` : ''}
        </div>`;
      
      L.marker([lat, lon], {
        icon: L.divIcon({ html: iconHtml, className: "", iconSize: [34, 34], iconAnchor: [17, 17] }),
        zIndexOffset: 1000
      }).addTo(busLayerGroup);
    }
  });
}

function createRouteCard(routeId, meta, stops, color) {
  const container = document.getElementById("routesContainer");
  const card = document.createElement("div"); 
  card.className = "route-card";
  card.dataset.routeId = routeId;
  
  const header = document.createElement("header");
  header.style.background = color;
  header.innerHTML = `
      <div class="line-main">
          <div>
              <span class="route-number">${meta.routeNumber || meta.routeCode}</span>
              <span class="headsign">${meta.headsign}</span>
          </div>
          <div style="font-size:12px; opacity:0.9">קו ${meta.routeCode}</div>
      </div>
      <div class="sub">
          <span>${meta.routeDate || ""}</span>
          <span class="last-update-text">ממתין לעדכון...</span>
      </div>
  `;
  
  const stopsList = document.createElement("div"); 
  stopsList.className = "stops-list";
  const rowsContainer = document.createElement("div"); 
  rowsContainer.className = "stops-rows";
  
  stops.forEach((stop, idx) => {
    const row = document.createElement("div"); 
    row.className = "stop-row";
    row.dataset.stopCode = stop.stopCode;
    
    const isFirst = idx === 0 ? " first" : "";
    const isLast = idx === stops.length - 1 ? " last" : "";
    const timelineHtml = `
        <div class="timeline-line line-top"></div>
        <div class="timeline-circle" style="border-color:${color}"></div>
        <div class="timeline-line line-bottom"></div>
    `;
    
    const timeline = document.createElement("div");
    timeline.className = "timeline" + isFirst + isLast;
    timeline.innerHTML = timelineHtml;
    
    const main = document.createElement("div");
    main.className = "stop-main";
    main.innerHTML = `
        <div class="stop-name">
            <span class="seq-num" style="color:${color}">${idx+1}.</span>
            <span>${stop.stopName}</span>
        </div>
        <div class="stop-code">${stop.stopCode || ""}</div>
        <div class="stop-buses" id="buses-${routeId}-${stop.stopCode}"></div>
    `;
    
    row.append(timeline, main);
    rowsContainer.appendChild(row);
  });

  stopsList.appendChild(rowsContainer);
  card.append(header, stopsList);
  container.appendChild(card);
  
  routeViews.set(routeId, { 
    lastUpdateSpan: header.querySelector(".last-update-text"),
    stopsList: stopsList,
    rowsContainer: rowsContainer,
    card: card
  });
}

function updateCardData(routeId, updateData, stops, color) {
  const view = routeViews.get(routeId);
  if (!view) return;

  const meta = updateData.meta || {};
  const snap = meta.lastSnapshot || meta.lastVehicleReport || new Date().toISOString();
  const timeStr = snap.split("T")[1]?.split(".")[0] || snap;
  view.lastUpdateSpan.textContent = "עדכון: " + timeStr;

  const busesByStop = new Map();
  const now = new Date();
  
  (updateData.vehicles || []).forEach(v => {
    if (!v.onwardCalls) return;
    v.onwardCalls.forEach(c => {
      if (!c.stopCode || !c.eta) return;
      const minutes = Math.round((new Date(c.eta) - now) / 60000);
      if (minutes < -1) return;
      
      const sc = String(c.stopCode);
      if (!busesByStop.has(sc)) busesByStop.set(sc, []);
      busesByStop.get(sc).push(minutes);
    });
  });

  stops.forEach(stop => {
    const container = document.getElementById(`buses-${routeId}-${stop.stopCode}`);
    if (!container) return;
    
    const times = busesByStop.get(String(stop.stopCode));
    if (times && times.length) {
      times.sort((a,b) => a-b);
      container.innerHTML = times.slice(0, 3).map(m => {
        let cls = "bus-late";
        let txt = m + " דק'";
        if (m <= 0) { txt = "כעת"; cls = "bus-soon"; }
        else if (m <= 5) cls = "bus-soon";
        else if (m <= 10) cls = "bus-mid";
        else if (m <= 20) cls = "bus-far";
        return `<div class="bus-chip ${cls}">${txt}</div>`;
      }).join("");
    } else {
      container.innerHTML = "";
    }
  });

  view.stopsList.querySelectorAll(".bus-icon-timeline").forEach(e => e.remove());
  
  const listHeight = view.rowsContainer.offsetHeight;
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
    icon.style.color = color;
    icon.style.top = top + "px";
    
    view.stopsList.appendChild(icon);
  });
}

function getVariedColor(hex, strSalt) {
  let c = hex.replace('#','');
  if(c.length===3) c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  let r=parseInt(c.substring(0,2),16), g=parseInt(c.substring(2,4),16), b=parseInt(c.substring(4,6),16);
  let hash=0; for(let i=0;i<strSalt.length;i++) hash=strSalt.charCodeAt(i)+((hash<<5)-hash);
  const v=(hash%60)-30; 
  const clamp=n=>Math.min(255,Math.max(0,Math.round(n+v)));
  return "#" + [clamp(r), clamp(g), clamp(b)].map(x=>x.toString(16).padStart(2,'0')).join("");
}

window.setUserLocation = function(lat, lon) {
  if (!mapInstance) return;
  if (userLocationMarker) userLocationMarker.remove();
  userLocationMarker = L.circleMarker([lat, lon], { 
    radius: 8, color: "#1976d2", 
    fillColor: "#2196f3", fillOpacity: 0.6 
  }).addTo(mapInstance);
};

function centerOnUser() {
  if (userLocationMarker) {
    mapInstance.setView(userLocationMarker.getLatLng(), 16);
  } else {
    alert("אין מיקום זמין");
  }
}

// ===== HIGHLIGHT FUNCTIONS =====
window.highlightRoute = function(routeId) {
  // הדגשת קו במפה - הבהוב
  const routeLine = document.querySelector(`.route-line.route-${routeId}`);
  if (routeLine) {
    routeLine.style.opacity = '0.3';
    setTimeout(() => routeLine.style.opacity = '1', 200);
    setTimeout(() => routeLine.style.opacity = '0.3', 400);
    setTimeout(() => routeLine.style.opacity = '1', 600);
    setTimeout(() => routeLine.style.opacity = '0.8', 800);
  }
  
  // הדגשת אוטובוסים של הקו
  const buses = busLayerGroup.getLayers();
  buses.forEach(marker => {
    const el = marker.getElement();
    if (el && el.querySelector(`[data-route-id="${routeId}"]`)) {
      const icon = el.querySelector('.main-bus-icon');
      if (icon) {
        icon.classList.add('highlight');
        setTimeout(() => icon.classList.remove('highlight'), 3000);
      }
    }
  });
  
  // מיקוד במסלול
  const view = routeViews.get(String(routeId));
  if (view && view.card) {
    view.card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

window.highlightStop = function(stopCode) {
  // הדגשת תחנה בכל הקווים
  const stopMarkers = document.querySelectorAll(`.stop-marker.stop-${stopCode}`);
  stopMarkers.forEach(marker => {
    marker.style.radius = '8';
    setTimeout(() => marker.style.radius = '3', 1600);
  });
  
  // הדגשת תחנה בכרטיסים
  const stopRows = document.querySelectorAll(`.stop-row[data-stop-code="${stopCode}"]`);
  stopRows.forEach(row => {
    const circle = row.querySelector('.timeline-circle');
    if (circle) {
      circle.classList.add('highlight');
      setTimeout(() => circle.classList.remove('highlight'), 1600);
    }
  });
};

// ===== STATIONS LOGIC =====
function initStations() {
  ensureStructure();
  initSearch();
  
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => notify('refreshLocation'));
  }
}

function ensureStructure() {
  const content = document.getElementById("content");
  if (!content) return;
  
  if (!content.querySelector(".stop-container")) {
    content.innerHTML = `
      <div id="loader-msg">
        <div class="spinner"></div>
        <div id="msg-text">טוען נתונים...</div>
      </div>
      <div class="stop-container" style="display:none">
        <h2 id="stop-title"></h2>
        <div id="cards-container"></div>
        <div id="empty-msg">אין נסיעות קרובות</div>
      </div>
    `;
  }
}

// Search
let touchStartY = 0;
let touchEndY = 0;

function initSearch() {
  const searchOverlay = document.getElementById('search-overlay');
  const searchContainer = document.getElementById('search-container');
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  
  if (!searchOverlay || !searchContainer || !searchInput) return;
  
  // זיהוי תנועת גלילה כלפי מעלה
  document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  });

  document.addEventListener('touchend', (e) => {
    touchEndY = e.changedTouches[0].clientY;
    const swipeDistance = touchEndY - touchStartY;

    if (swipeDistance > 100) {
      showSearch();
    }
  });
  
  searchOverlay.addEventListener('click', hideSearch);
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length === 0) {
      searchResults.classList.remove('visible');
      return;
    }
    
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });
  
  searchContainer.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

function showSearch() {
  document.getElementById('search-overlay').classList.add('visible');
  document.getElementById('search-container').classList.add('visible');
  document.getElementById('search-input').focus();
}

function hideSearch() {
  document.getElementById('search-overlay').classList.remove('visible');
  document.getElementById('search-container').classList.remove('visible');
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').classList.remove('visible');
}

function performSearch(query) {
  notify("search/" + encodeURIComponent(query));
}

window.displaySearchResults = function(results) {
  const searchResults = document.getElementById('search-results');
  
  if (!results || results.length === 0) {
    searchResults.innerHTML = '<div style="padding:20px; text-align:center; color:#6b7280;">לא נמצאו תוצאות</div>';
    searchResults.classList.add('visible');
    return;
  }
  
  searchResults.innerHTML = results.map(stop => `
    <div class="search-result-item" onclick="selectSearchResult('${stop.stopCode}', ${stop.lat}, ${stop.lon})">
      <div class="search-result-name">${stop.stopName}</div>
      <div class="search-result-code">קוד: ${stop.stopCode} | מזהה: ${stop.stopId}</div>
      <div class="search-result-desc">${stop.stopDesc || ''}</div>
    </div>
  `).join('');
  
  searchResults.classList.add('visible');
};

function selectSearchResult(stopCode, lat, lon) {
  hideSearch();
  notify("selectSearchStop/" + stopCode + "/" + lat + "/" + lon);
}

window.resetUI = function(msg) {
  STOPS = []; 
  DATA = {}; 
  currentStopCode = null;
  document.getElementById("scroll-area").innerHTML = "";
  const loader = document.getElementById("loader-msg");
  if(loader) {
    loader.style.display = "flex";
    document.getElementById("msg-text").textContent = msg || 'טוען...';
    document.querySelector(".stop-container").style.display = "none";
  } else {
    ensureStructure(); 
  }
};

window.addStops = function(newStops, selectFirst = false) {
  ensureStructure();
  const scrollArea = document.getElementById("scroll-area");
  const existingPlus = document.getElementById("load-more-btn");
  if(existingPlus) existingPlus.remove();

  newStops.forEach(s => {
    if (STOPS.find(x => x.stopCode === s.stopCode)) return;
    STOPS.push(s);
    const btn = document.createElement("button");
    btn.className = "station-btn";
    btn.dataset.code = s.stopCode;
    btn.innerHTML = `<span class="btn-name">${s.name}</span><span class="btn-code">${s.stopCode}</span>`;
    btn.onclick = () => selectStop(s.stopCode);
    scrollArea.appendChild(btn);
  });

  const plusBtn = document.createElement("button");
  plusBtn.id = "load-more-btn";
  plusBtn.innerHTML = "+";
  plusBtn.onclick = () => notify('loadMore');
  scrollArea.appendChild(plusBtn);

  if (selectFirst && STOPS.length > 0) selectStop(STOPS[0].stopCode);
};

window.updateStopName = function(code, name) {
  const s = STOPS.find(x => x.stopCode === String(code));
  if (s) {
    s.name = name;
    const btn = document.querySelector(`button[data-code="${code}"] .btn-name`);
    if (btn) btn.textContent = name;
    if (currentStopCode === String(code)) {
       document.getElementById("stop-title").textContent = name;
    }
  }
};

window.updateStationData = function(stopCode, data) {
  DATA[stopCode] = data;
  if (currentStopCode === String(stopCode)) {
    syncUI(data);
  }
};

function selectStop(code) {
  currentStopCode = String(code);
  
  notify("setActiveStop/" + code);
  
  // הדגש במפה
  notify("highlightStop/" + code);

  const stopInfo = STOPS.find(s => s.stopCode === currentStopCode);
  
  document.querySelectorAll(".station-btn").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`button[data-code="${code}"]`);
  if (btn) {
    btn.classList.add("active");
    btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  const loader = document.getElementById("loader-msg");
  if(loader) loader.style.display = "none";
  const container = document.querySelector(".stop-container");
  if(container) container.style.display = "block";

  document.getElementById("stop-title").textContent = stopInfo ? stopInfo.name : "תחנה";

  const data = DATA[currentStopCode];
  syncUI(data);
}

function generateGroupKey(g) { 
  return g.line + "||" + g.headsign; 
}

function formatArrival(minutes){
  if (minutes <= 0) return "כעת";
  if (minutes < 60) return minutes + " דק'";
  const d = new Date(); 
  d.setMinutes(d.getMinutes() + minutes);
  return d.toLocaleTimeString("he-IL", {hour:"2-digit", minute:"2-digit"});
}

function createLineCard(g) {
  const card = document.createElement("div");
  card.className = "line-card";
  card.dataset.key = generateGroupKey(g);
  card.dataset.routeId = g.routeId;
  
  // לחיצה על כרטיס - הדגשה במפה
  card.onclick = () => {
    if (g.routeId) {
      notify("highlightRoute/" + g.routeId);
    }
  };
  
  let html = `
    <div class="line-header">
      <div class="route-num">${g.line}</div>
      <div class="headsign">${g.headsign}</div>
    </div>
    <div class="times-row">`;
  
  for(let i=0; i<4; i++) {
    html += `<div class="time-chip" data-idx="${i}" style="display:none">
      <div class="pulse-dot"></div>
      <span class="t-val"></span>
    </div>`;
  }
  html += `</div>`;
  card.innerHTML = html;
  updateCardTimes(card, g.arrivals);
  return card;
}

function updateCardTimes(card, arrivals) {
  const chips = card.querySelectorAll(".time-chip");
  chips.forEach((chip, i) => {
    const a = arrivals[i];
    if (!a) {
      if (chip.style.display !== "none") chip.style.display = "none";
    } else {
      if (chip.style.display !== "flex") chip.style.display = "flex";
      
      const isRt = !!a.realtime;
      const isStale = !!a.stale;

      chip.classList.toggle("realtime", isRt && !isStale);
      chip.classList.toggle("stale", isRt && isStale);
      
      const dot = chip.querySelector(".pulse-dot");
      const dotDisplay = isRt ? "block" : "none";
      if (dot.style.display !== dotDisplay) dot.style.display = dotDisplay;

      const valSpan = chip.querySelector(".t-val");
      const newText = formatArrival(a.minutes);
      if (valSpan.textContent !== newText) valSpan.textContent = newText;
    }
  });
}

function syncUI(data) {
  const cardsContainer = document.getElementById("cards-container");
  const emptyMsg = document.getElementById("empty-msg");
  
  if (!data || !data.groups || data.groups.length === 0) {
    cardsContainer.innerHTML = "";
    emptyMsg.style.display = "block";
    return;
  }
  
  emptyMsg.style.display = "none";
  const groups = data.groups;
  
  const currentCards = Array.from(cardsContainer.children);
  const newKeys = new Set(groups.map(generateGroupKey));

  currentCards.forEach(card => {
    if (!newKeys.has(card.dataset.key)) {
      card.remove();
    }
  });

  groups.forEach(g => {
    const key = generateGroupKey(g);
    let card = cardsContainer.querySelector(`.line-card[data-key="${key}"]`);

    if (card) {
      updateCardTimes(card, g.arrivals);
      cardsContainer.appendChild(card);
    } else {
      card = createLineCard(g);
      cardsContainer.appendChild(card);
    }
  });
}

// ===== BOTTOM SHEET =====
function initBottomSheet() {
  const sheet = document.getElementById('bottomSheet');
  const handle = document.getElementById('dragHandleArea');
  if (!sheet || !handle) return;
  
  let startY = 0, startH = 0;
  
  handle.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    startH = sheet.offsetHeight;
    sheet.style.transition = 'none';
  });
  
  document.addEventListener('touchmove', e => {
    if (!startY) return;
    const delta = startY - e.touches[0].clientY;
    let h = startH + delta;
    h = Math.max(60, Math.min(window.innerHeight * 0.9, h));
    sheet.style.height = h + "px";
  });
  
  document.addEventListener('touchend', () => {
    startY = 0;
    sheet.style.transition = 'height 0.3s ease';
    const h = sheet.offsetHeight;
    if (h < 150) sheet.style.height = "60px";
    else if (h > window.innerHeight * 0.6) sheet.style.height = "85vh";
    else sheet.style.height = "45vh";
  });
}