// view.js – גרסה מלאה ומעודכנת כולל פאנל נגרר

module.exports.getHtml = function() {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>מסלולי קווים</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0&icon_names=directions_bus" />
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

<style>

/* ================================
   סגנון אייקון אוטובוס
================================ */
.material-symbols-outlined {
  font-variation-settings: 'FILL' 1, 'Wght' 600, 'GRAD' 0, 'opsz' 24;
  font-size: 26px;
  line-height: 1;
}

/* ================================
   אייקוני אוטובוסים
================================ */
.bus-marker-container {
  position: relative;
  width: 34px; height: 34px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.bus-direction-arrow {
  position: absolute;
  top:0; left:0;
  width:100%; height:100%;
  display:flex;
  justify-content:center;
  align-items:flex-start;
  pointer-events:none;
}

.bus-direction-arrow svg {
  margin-top:-14px;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}

.main-bus-icon {
  width:34px; height:34px;
  border-radius:50%;
  display:flex;
  align-items:center;
  justify-content:center;
  color:#fff;
  box-shadow:0 2px 5px rgba(0,0,0,0.4);
  border:2px solid #fff;
  z-index:10;
}

/* תגית עם מספר קו */
.route-badge {
  position:absolute;
  top:-6px; right:-6px;
  background:#fff;
  border-radius:99px;
  height:18px; min-width:18px;
  padding:0 3px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:11px;
  font-weight:800;
  border:2px solid currentColor;
  box-shadow:0 1px 3px rgba(0,0,0,0.3);
  z-index:20;
}

/* ================================
   פריסה כללית
================================ */
:root { color-scheme: light dark; }
body {
  margin:0;
  font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background:#f4f4f4;
  direction:rtl;
  color:#111;
}

#topContainer {
  position:relative;
  width:100%;
  height:100vh;
  overflow:hidden;
}

/* מפה */
#map {
  width:100%;
  height:300px;
  transition:height 0.25s ease;
  background:#ddd;
}

/* כפתור מצא אותי */
#locateMeBtn {
  position:absolute;
  top:10px; right:10px;
  width:36px; height:36px;
  background:white;
  border:1px solid #1976d2;
  border-radius:50%;
  display:flex;
  align-items:center;
  justify-content:center;
  box-shadow:0 2px 4px rgba(0,0,0,0.25);
  z-index:500;
  cursor:pointer;
}

/* ================================
   פאנל נגרר (Bottom Sheet)
================================ */
#routesWrapper {
  position:absolute;
  bottom:0;
  left:0;
  right:0;
  height:40px; /* חלק מציץ */
  background:white;
  border-top-left-radius:14px;
  border-top-right-radius:14px;
  box-shadow:0 -3px 12px rgba(0,0,0,0.25);
  transition:height 0.25s ease;
  overflow:hidden;
  touch-action:none;
}

#dragHandle {
  width:50px;
  height:6px;
  background:#bbb;
  border-radius:3px;
  margin:8px auto;
}

/* אזור המסלולים */
#routesContainer {
  overflow-x:auto;
  overflow-y:hidden;
  padding:10px;
  display:flex;
  gap:12px;
  height:calc(100% - 30px);
}

/* ================================
   כרטיסי מסלול
================================ */
.route-card {
  background:white;
  min-width:300px;
  max-width:420px;
  border-radius:10px;
  box-shadow:0 1px 4px rgba(0,0,0,0.18);
  display:flex;
  flex-direction:column;
  overflow:hidden;
}

header {
  background:#1976d2;
  color:white;
  padding:10px;
  position:sticky;
  top:0;
}

header .route-number {
  background:rgba(0,0,0,0.25);
  padding:2px 8px;
  border-radius:99px;
  font-size:18px;
  font-weight:bold;
}

.stops-list {
  background:white;
  overflow-y:auto;
  max-height:200px;
}

.stop-row {
  display:flex;
  flex-direction:row;
  align-items:flex-start;
  min-height:50px;
  border-bottom:1px solid #eee;
}

.timeline {
  width:40px;
  display:flex;
  flex-direction:column;
  align-items:center;
  padding-top:4px;
}

.timeline-circle {
  width:14px; height:14px;
  background:white;
  border-radius:50%;
  border:3px solid #1976d2;
}

.stop-main {
  flex:1;
  padding:6px;
}

.stop-name {
  font-size:15px;
  font-weight:600;
}

.bus-icon {
  position:absolute;
  right:25px;
  font-size:24px;
  pointer-events:none;
  transform:translate3d(50%,-50%,0);
}

/* תחתית כללית */
.footer-note-global {
  font-size:10px;
  text-align:center;
  margin:8px 0;
  color:#777;
}

</style>
</head>

<body>
<div id="topContainer">

  <!-- מפה -->
  <div id="map">
    <button id="locateMeBtn">📍</button>
  </div>

  <!-- פאנל מסלולים נגרר -->
  <div id="routesWrapper">
    <div id="dragHandle"></div>
    <div id="routesContainer"></div>
  </div>

</div>

<div class="footer-note-global">
  המיקום מוערך ע"י המערכת (ETA) • המפה מבוססת על מסלולי shape של KavNav.
</div>

<script>

let payloads = [];
let initialized = false;
const routeViews = new Map();

let mapInstance = null;
let mapRouteLayers = [];
let mapDidInitialFit = false;
let mapBusLayers = [];
let routesVisible = true;

let allStopsLayer = null;
let userLocation = null;
let userLocationMarker = null;

/* ================================
   טעינת דף + פאנל נגרר
================================ */
document.addEventListener("DOMContentLoaded", function () {

  const wrapper = document.getElementById("routesWrapper");
  const handle = document.getElementById("dragHandle");
  const mapDiv = document.getElementById("map");

  let startY = 0;
  let startHeight = 0;

  const MIN_HEIGHT = 40;
  const MAX_HEIGHT = window.innerHeight * 0.70;

  function setHeight(h) {
    h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h));
    wrapper.style.height = h + "px";

    mapDiv.style.height = (window.innerHeight - h) + "px";

    if (window.mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 120);
    }
  }

  handle.addEventListener("touchstart", (e) => {
    startY = e.touches[0].clientY;
    startHeight = wrapper.offsetHeight;
  });

  handle.addEventListener("touchmove", (e) => {
    const delta = startY - e.touches[0].clientY;
    setHeight(startHeight + delta);
  });

  // כפתור מצא אותי
  const locateBtn = document.getElementById("locateMeBtn");
  locateBtn.addEventListener("click", () => {
    if (userLocation) {
      focusMapOnUser(userLocation.lat, userLocation.lon);
    }
  });

});

/* ================================
   מיקום משתמש
================================ */
function focusMapOnUser(lat, lon) {
  if (!mapInstance) return;

  const latLng = [lat, lon];

  if (userLocationMarker) {
    mapInstance.removeLayer(userLocationMarker);
  }

  userLocationMarker = L.circleMarker(latLng, {
    radius: 8,
    color: "#1976d2",
    fillColor: "#1976d2",
    fillOpacity: 0.4,
    weight:2
  }).addTo(mapInstance);

  mapInstance.setView(latLng, 16);
}

window.setUserLocation = function(lat, lon) {
  userLocation = { lat, lon };
};

/* ================================
   עיבוד ETA לפי תחנה
================================ */
function buildBusIndex(vehicles) {
  const byStop = new Map();
  const now = new Date();

  for (const v of vehicles) {
    const calls = v.onwardCalls || [];
    for (const c of calls) {
      if (!c.stopCode || !c.eta) continue;

      const stop = String(c.stopCode);
      const etaDate = new Date(c.eta);
      let minutes = Math.round((etaDate - now) / 60000);

      if (minutes < -2) continue;

      if (!byStop.has(stop)) byStop.set(stop, []);
      byStop.get(stop).push({ minutes });
    }
  }

  for (const arr of byStop.values()) {
    arr.sort((a, b) => a.minutes - b.minutes);
  }

  return byStop;
}

function classifyMinutes(m) {
  if (m <= 3) return "bus-soon";
  if (m <= 7) return "bus-mid";
  if (m <= 15) return "bus-far";
  return "bus-late";
}

function formatMinutesLabel(m) {
  return m <= 0 ? "כעת" : m + " דק׳";
}

/* ================================
   יצירת ממשק כרטיסי מסלול
================================ */
function ensureLayout(allPayloads) {

  if (initialized) return;

  const container = document.getElementById("routesContainer");
  container.innerHTML = "";

  allPayloads.forEach((p) => {
    const meta = p.meta || {};
    const routeIdStr = String(meta.routeId);

    const card = document.createElement("div");
    card.className = "route-card";

    const header = document.createElement("header");
    const rn = document.createElement("div");
    rn.className = "route-number";
    rn.textContent = meta.routeNumber || meta.routeCode || "";

    const hs = document.createElement("div");
    hs.className = "headsign";
    hs.textContent = meta.headsign || "";

    header.appendChild(rn);
    header.appendChild(hs);

    const stopsList = document.createElement("div");
    stopsList.className = "stops-list";

    const rows = document.createElement("div");
    rows.className = "stops-rows";

    stopsList.appendChild(rows);
    card.appendChild(header);
    card.appendChild(stopsList);

    routeViews.set(routeIdStr, {
      card,
      header,
      rn,
      hs,
      stopsList,
      rows
    });

    container.appendChild(card);
  });

  initialized = true;
}

/* ================================
   ציור מסלולים ואוטובוסים על המפה
================================ */
function ensureMapInstance(allPayloads) {

  const mapDiv = document.getElementById("map");

  if (!mapInstance) {
    mapInstance = L.map("map");

    L.tileLayer(
      "https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png",
      { maxZoom: 19 }
    ).addTo(mapInstance);
  }

  mapRouteLayers.forEach((l) => mapInstance.removeLayer(l));
  mapRouteLayers = [];

  const allLatLngs = [];

  allPayloads.forEach((p) => {

    const group = L.layerGroup();

    const shape = p.shapeCoords || [];

    if (shape.length) {
      const latlngs = shape.map(c => [c[1], c[0]]);
      L.polyline(latlngs, { color:"#1976d2", weight:4, opacity:0.9 }).addTo(group);
      latlngs.forEach(ll => allLatLngs.push(ll));
    }

    (p.stops || []).forEach(s => {
      if (!s.lat || !s.lon) return;
      const ll = [s.lat, s.lon];
      L.circleMarker(ll, { radius:3, color:"#555" }).addTo(group);
      allLatLngs.push(ll);
    });

    // אוטובוסים
    const shapeLatLngs = shape.map(c => [c[1], c[0]]);

    (p.vehicles || []).forEach(v => {
      if (typeof v.positionOnLine !== "number") return;
      const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
      const ll = shapeLatLngs[idx];
      if (!ll) return;

      const bearing = v.bearing || 0;
      const routeNum = v.routeNumber || "";

      const iconHtml = \`
        <div class="bus-marker-container">
          <div class="bus-direction-arrow" style="transform:rotate(\${bearing}deg)">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="#1976d2" stroke="white" stroke-width="2">
              <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/>
            </svg>
          </div>

          <div class="main-bus-icon" style="background:#1976d2">
            <span class="material-symbols-outlined">directions_bus</span>
          </div>

          \${routeNum ? \`<div class="route-badge" style="color:#1976d2">\${routeNum}</div>\` : ""}
        </div>
      \`;

      L.marker(ll, {
        icon: L.divIcon({
          html: iconHtml,
          className:"",
          iconSize:[34,34],
          iconAnchor:[17,17]
        })
      }).addTo(group);
    });

    group.addTo(mapInstance);
    mapRouteLayers.push(group);
  });

  if (allLatLngs.length && !mapDidInitialFit) {
    mapInstance.fitBounds(allLatLngs, { padding:[20,20] });
    mapDidInitialFit = true;
  }
}

/* ================================
   רינדור המסלולים וה־ETA
================================ */
function renderAll() {

  if (!payloads || !payloads.length) return;

  ensureLayout(payloads);
  ensureMapInstance(payloads);

  payloads.forEach(p => {
    const meta = p.meta || {};
    const v = routeViews.get(String(meta.routeId));
    if (!v) return;

    const vehicles = p.vehicles || [];
    const stops = p.stops || [];

    const byStop = buildBusIndex(vehicles);

    v.rows.innerHTML = "";

    stops.forEach((s, idx) => {
      const row = document.createElement("div");
      row.className = "stop-row";

      const tl = document.createElement("div");
      tl.className = "timeline";
      tl.innerHTML = '<div class="timeline-circle"></div>';

      const main = document.createElement("div");
      main.className = "stop-main";

      main.innerHTML = \`
        <div class="stop-name">\${idx+1}. \${s.stopName}</div>
        <div class="stop-code">\${s.stopCode || ""}</div>
      \`;

      const busList = byStop.get(String(s.stopCode)) || [];
      if (busList.length) {
        const bc = document.createElement("div");
        bc.style.marginTop = "4px";
        busList.slice(0,3).forEach(b => {
          const chip = document.createElement("span");
          chip.className = classifyMinutes(b.minutes);
          chip.textContent = formatMinutesLabel(b.minutes);
          chip.style.marginLeft = "4px";
          bc.appendChild(chip);
        });
        main.appendChild(bc);
      }

      row.appendChild(tl);
      row.appendChild(main);
      v.rows.appendChild(row);
    });
  });
}

/* ================================
   API חיצוני
================================ */
window.updateData = function(newP) {
  payloads = newP;
  renderAll();
};

</script>

</body>
</html>`;
};