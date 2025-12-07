// view.js
// מכיל רק את ה-HTML string עם עדכונים ביצועים וגוונים משופרים
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
/* עדכון סגנון האייקון הכללי - שיהיה מלא ועבה */
.material-symbols-outlined { font-variation-settings: 'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24; font-size: 26px; line-height: 1; }
/* סגנונות חדשים עבור האייקון המשולב במפה */
.bus-marker-container { position: relative; width: 34px; height: 34px; }
/* העיגול הראשי הצבעוני */
.main-bus-icon { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.4); border: 2px solid #fff; }
.main-bus-icon .material-symbols-outlined { font-size: 20px; }
/* התגית הקטנה עם מספר הקו */
.route-badge { position: absolute; top: -6px; right: -6px; background: #fff; border-radius: 99px; height: 18px; min-width: 18px; padding: 0 3px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; }
/* חץ כיוון נסיעה SVG */
.direction-arrow { position: absolute; bottom: -8px; right: 50%; transform: translateX(50%); width: 16px; height: 16px; }
:root { color-scheme: light dark; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f4f4; color: #111; direction: rtl; }
#topContainer { display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; position: relative; }
#map { width: 100%; height: 260px; flex-shrink: 0; border-bottom: 1px solid #ddd; transition: height 0.3s ease; }
#map.expanded { height: calc(100vh - 80px); }
#toggleButton { position: absolute; top: 270px; left: 50%; transform: translateX(-50%); z-index: 200; background: #fff; border: none; border-radius: 20px; padding: 8px 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #1976d2; transition: all 0.3s ease; }
#toggleButton:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.3); transform: translateX(-50%) translateY(-2px); }
#toggleButton:active { transform: translateX(-50%) translateY(0); }
#toggleButton .material-symbols-outlined { font-size: 20px; }
#routesContainer { display: flex; flex-direction: row; gap: 12px; padding: 8px; overflow-x: auto; box-sizing: border-box; flex: 1 1 auto; transition: all 0.3s ease; }
#routesContainer.hidden { opacity: 0; pointer-events: none; height: 0; min-height: 0; padding: 0; overflow: hidden; }
.route-card { background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.15); min-width: 320px; max-width: 420px; display: flex; flex-direction: column; overflow: hidden; height: fit-content; }
header { background: #1976d2; color: #fff; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
header .line-main { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
header .route-number { font-weight: 700; font-size: 20px; padding: 2px 8px; border-radius: 999px; background: rgba(0,0,0,0.25); }
header .headsign { font-size: 15px; font-weight: 500; }
header .sub { font-size: 11px; opacity: 0.9; display: flex; justify-content: space-between; gap: 10px; }
.stops-list { background: #fff; position: relative; overflow-y: auto; overflow-x: hidden; padding: 0; padding-bottom: 20px; transform: translate3d(0,0,0); flex: 1; max-height: calc(100vh - 400px); will-change: scroll-position; }
.stops-rows { width: 100%; }
.stop-row { display: flex; flex-direction: row; align-items: stretch; gap: 0; min-height: 50px; }
.timeline { width: 50px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; position: relative; }
.timeline-line { width: 4px; background: #e0e0e0; flex: 1; }
.timeline-circle { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 3px solid #1976d2; box-sizing: border-box; z-index: 2; margin: -2px 0; }
.timeline.first .line-top { visibility: hidden; }
.timeline.last .line-bottom { visibility: hidden; }
.stop-main { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 8px 10px 8px 0; border-bottom: 1px solid #f0f0f0; }
.stop-name { font-size: 15px; font-weight: 600; display: flex; gap: 4px; }
.seq-num { color: #1976d2; font-weight: 700; min-width: 18px; }
.stop-code { font-size: 11px; color: #777; margin-right: 22px; }
.stop-buses { margin-top: 6px; margin-right: 22px; display: flex; flex-wrap: wrap; gap: 4px; }
.bus-chip { border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; }
.bus-soon { background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; }
.bus-mid  { background: #fffde7; color: #f9a825; border: 1px solid #fff9c4; }
.bus-far  { background: #e1f5fe; color: #0277bd; border: 1px solid #b3e5fc; }
.bus-late { background: #f5f5f5; color: #757575; border: 1px solid #e0e0e0; }
.footer-note-global { margin: 4px 0 10px; font-size: 10px; color: #999; text-align: center; }
.bus-icon { position: absolute; right: 25px; font-size: 24px; z-index: 50; pointer-events: none; will-change: top; transform: translate3d(50%, -50%, 0); -webkit-transform: translate3d(50%, -50%, 0); backface-visibility: hidden; transition: top 1s linear; }
</style>
</head>
<body>
<div id="topContainer">
<div id="map"></div>
<button id="toggleButton">
<span class="material-symbols-outlined">unfold_less</span>
<span id="toggleText">הסתר מסלולים</span>
</button>
<div id="routesContainer"></div>
</div>
<div class="footer-note-global">המיקום מוערך ע"י המערכת (ETA) • המפה מבוססת על מסלולי shape של KavNav.</div>
<script>
let payloads = []; 
let initialized = false; 
const routeViews = new Map();
let mapInstance = null; 
let mapRouteLayers = []; 
let mapDidInitialFit = false; 
let mapBusMarkers = new Map();  // ← מפה של markers עבור עדכון מהיר
let routesVisible = true;
let allStopsLayer = null;
let routeColorVariations = new Map();  // ← לשמירת גוונים שונים לכל מסלול

// ===== פונקציית עזר: יצירת SVG arrow לכיוון נסיעה =====
function createDirectionArrowSVG(heading) {
  // heading בדרגות: 0=צפון, 90=מזרח, 180=דרום, 270=מערב
  if (heading == null) heading = 0;
  
  const rotation = Number(heading) || 0;
  
  const svgHtml = \`
    <svg class="direction-arrow" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(\${rotation} 8 8)">
        <!-- הצבע יתעדכן דינמית דרך inline style -->
        <polygon points="8,2 14,12 8,10 2,12" fill="currentColor" />
      </g>
    </svg>
  \`;
  
  return svgHtml;
}

// ===== פונקציית עזר: יצירת צבע עם גוון שונה לכל מסלול =====
function getRouteVariationColor(baseColor, routeId) {
  // אם כבר יצרנו גוון עבור המסלול הזה, נחזיר אותו
  const key = \`\${baseColor}-\${routeId}\`;
  if (routeColorVariations.has(key)) {
    return routeColorVariations.get(key);
  }
  
  // המר צבע hex ל-HSL
  function hexToHsl(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return [h * 360, s * 100, l * 100];
  }
  
  // המר HSL חזרה ל-hex
  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const v = Math.max(0, Math.min(1, (k(n) - 3 < 0 || k(n) > 9) ? 0 : Math.sin((k(n) - 9) * Math.PI / 6) * a + l));
      return Math.round(v * 255).toString(16).padStart(2, '0');
    };
    return \`#\${f(0)}\${f(8)}\${f(4)}\`;
  }
  
  // חלץ HSL מהצבע
  const [h, s, l] = hexToHsl(baseColor);
  
  // יצירת גוון שונה בהתאם ל-routeId
  // נשתמש ב-hash פשוט של routeId לשינוי הLightness
  const hashValue = String(routeId).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  // שינוי Lightness בטווח קטן (±10%) כדי להישאר באותו גוון
  const lightnessOffset = (Math.abs(hashValue) % 21) - 10;  // בטווח -10 עד 10
  const newLightness = Math.max(15, Math.min(85, l + lightnessOffset));
  
  const variatedColor = hslToHex(h, s, newLightness);
  routeColorVariations.set(key, variatedColor);
  
  return variatedColor;
}

// טיפול בכפתור הסתרה/הצגה
document.addEventListener('DOMContentLoaded', function() {
const toggleBtn = document.getElementById('toggleButton');
const routesContainer = document.getElementById('routesContainer');
const mapDiv = document.getElementById('map');
const toggleText = document.getElementById('toggleText');
const toggleIcon = toggleBtn.querySelector('.material-symbols-outlined');

toggleBtn.addEventListener('click', function() {
routesVisible = !routesVisible;
if (routesVisible) {
routesContainer.classList.remove('hidden');
mapDiv.classList.remove('expanded');
toggleText.textContent = 'הסתר מסלולים';
toggleIcon.textContent = 'unfold_less';
toggleBtn.style.top = '270px';
} else {
routesContainer.classList.add('hidden');
mapDiv.classList.add('expanded');
toggleText.textContent = 'הצג מסלולים';
toggleIcon.textContent = 'unfold_more';
toggleBtn.style.top = 'calc(100vh - 70px)';
}
// רענון גודל המפה
if (mapInstance) {
setTimeout(() => mapInstance.invalidateSize(), 350);
}
});
});

function buildBusIndex(vehicles) {
const byStop = new Map(); 
const now = new Date();
for (const v of vehicles) {
const calls = Array.isArray(v.onwardCalls) ? v.onwardCalls : [];
for (const c of calls) {
if (!c || !c.stopCode || !c.eta) continue;
const stopCode = String(c.stopCode); 
const etaDate = new Date(c.eta);
let minutes = Math.round((etaDate.getTime() - now.getTime()) / 60000);
if (minutes < -2) continue;
if (!byStop.has(stopCode)) byStop.set(stopCode, []);
byStop.get(stopCode).push({ minutes });
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
  const lineMain = document.createElement("div"); 
  lineMain.className = "line-main";
  
  const leftDiv = document.createElement("div");
  const routeNumSpan = document.createElement("span"); 
  routeNumSpan.className = "route-number";
  const headsignSpan = document.createElement("span"); 
  headsignSpan.className = "headsign";
  leftDiv.append(routeNumSpan, headsignSpan);
  
  const metaLineDiv = document.createElement("div"); 
  metaLineDiv.style.fontSize = "12px"; 
  metaLineDiv.style.opacity = "0.9";
  lineMain.append(leftDiv, metaLineDiv);
  
  const subDiv = document.createElement("div"); 
  subDiv.className = "sub";
  const routeDateSpan = document.createElement("span"); 
  const snapshotSpan = document.createElement("span"); 
  snapshotSpan.textContent = "עדכון: -";
  subDiv.append(routeDateSpan, snapshotSpan);
  
  header.append(lineMain, subDiv);
  
  const stopsList = document.createElement("div"); 
  stopsList.className = "stops-list";
  stopsList.id = \`stops-list-\${routeIdStr}\`;
  
  const rowsContainer = document.createElement("div"); 
  rowsContainer.className = "stops-rows";
  stopsList.appendChild(rowsContainer);
  
  card.append(header, stopsList);
  container.appendChild(card);
  
  routeViews.set(routeIdStr, { 
    card, 
    header, 
    routeNumSpan, 
    headsignSpan, 
    metaLineDiv, 
    routeDateSpan, 
    snapshotSpan, 
    stopsList, 
    rowsContainer 
  });
});
initialized = true;
}

function ensureMapInstance(allPayloads) {
if (!document.getElementById("map")) return;
if (!mapInstance) {
mapInstance = L.map("map");

// מפה נקייה עם שמות רחובות - Carto Light
L.tileLayer("https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: ""
}).addTo(mapInstance);

// שכבת כל התחנות מכל stops.json (אם הוזרק מהסקריפט)
if (!allStopsLayer && window.stopsDataJson) {
  try {
    const stops = JSON.parse(window.stopsDataJson || "[]");
    allStopsLayer = L.layerGroup().addTo(mapInstance);

    stops.forEach(st => {
      const lat = Number(st.lat);
      const lon = Number(st.lon);
      if (!isFinite(lat) || !isFinite(lon)) return;

      L.circleMarker([lat, lon], {
        radius: 3,
        weight: 1,
        color: "#555",
        fillColor: "#fff",
        fillOpacity: 1
      })
      .bindTooltip(
        (st.stopName || "") + (st.stopCode ? " (" + st.stopCode + ")" : ""),
        {direction:"top", offset:[0,-4]}
      )
      .addTo(allStopsLayer);
    });

  } catch (e) {
    console.error("Error parsing/adding all stops:", e);
  }
}

}
mapRouteLayers.forEach(l => { 
  try { mapInstance.removeLayer(l); } catch (e) {} 
}); 
mapRouteLayers = [];
mapBusMarkers.forEach(m => {
  try { mapInstance.removeLayer(m); } catch (e) {}
});
mapBusMarkers.clear();

const allLatLngs = [];

allPayloads.forEach(p => {
const meta = p.meta || {}; 
const operatorColor = meta.operatorColor || "#1976d2";
const routeId = meta.routeId;
// ← שימוש בצבע עם גוון משתנה
const routeColor = getRouteVariationColor(operatorColor, routeId);
const shapeCoords = Array.isArray(p.shapeCoords) ? p.shapeCoords : [];
const stops = Array.isArray(p.stops) ? p.stops : [];
const group = L.layerGroup();

if (shapeCoords.length) {
  const latlngs = shapeCoords.map(c => Array.isArray(c) && c.length >= 2 ? [c[1], c[0]] : null).filter(Boolean);
  if (latlngs.length) {
    // ← שימוש ב-routeColor במקום operatorColor
    L.polyline(latlngs, { weight: 4, opacity: 0.9, color: routeColor }).addTo(group);
    latlngs.forEach(ll => allLatLngs.push(ll));
  }
}

stops.forEach(s => {
  if (typeof s.lat === "number" && typeof s.lon === "number") {
    const ll = [s.lat, s.lon];
    L.circleMarker(ll, { radius: 3, weight: 1, color: "#666" }).bindTooltip((s.stopName||"")+(s.stopCode?" ("+s.stopCode+")":""),{direction:"top",offset:[0,-4]}).addTo(group);
    allLatLngs.push(ll);
  }
});

  // Vehicles עם חץ כיוון
  const vehicles = Array.isArray(p.vehicles) ? p.vehicles : [];
  const shapeLatLngs = shapeCoords.map(c => Array.isArray(c) && c.length >= 2 ? [c[1], c[0]] : null).filter(Boolean);
  vehicles.forEach(v => {
    if (typeof v.positionOnLine !== "number" || !shapeLatLngs.length) return;
    const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
    const ll = shapeLatLngs[idx];
    if (ll) {
      const routeNum = v.routeNumber || "";
      
      // חישוב heading בהתאם לכיוון התנועה
      let heading = 0;
      if (idx < shapeLatLngs.length - 1) {
        const nextLl = shapeLatLngs[idx + 1];
        const dLat = nextLl[0] - ll[0];
        const dLon = nextLl[1] - ll[1];
        heading = Math.atan2(dLon, dLat) * 180 / Math.PI;
      }
      
      const iconHtml = \`
        <div class="bus-marker-container">
          <div class="main-bus-icon" style="background:\${routeColor};">
            <span class="material-symbols-outlined">directions_bus</span>
          </div>
          \${routeNum ? \`<div class="route-badge" style="color:\${routeColor};">\${routeNum}</div>\` : ''}
          \${createDirectionArrowSVG(heading)}
        </div>
      \`;
      
      const marker = L.marker(ll, {
         icon: L.divIcon({
             html: iconHtml,
             className: "",
             iconSize: [34, 34],
             iconAnchor: [17, 17]
         }),
         zIndexOffset: 1000
      }).addTo(group);
      
      mapBusMarkers.set(\`\${meta.routeId}-\${v.vehicleId}\`, marker);
    }
  });
  
  group.addTo(mapInstance); 
  mapRouteLayers.push(group);
});

if (allLatLngs.length && !mapDidInitialFit) { 
  mapInstance.fitBounds(allLatLngs, { padding: [20, 20] }); 
  mapDidInitialFit = true; 
}
}

// ===== RENDER FULL - משמש רק ליצירה ראשונית =====
function renderAll() {
if (!payloads || !payloads.length) return;
ensureLayout(payloads);
ensureMapInstance(payloads);

// עדכון כל התוכן (stops, header וכו')
payloads.forEach((payload) => {
  const meta = payload.meta || {}; 
  const stops = payload.stops || []; 
  const vehicles = payload.vehicles || [];
  const operatorColor = meta.operatorColor || "#1976d2";
  const routeColor = getRouteVariationColor(operatorColor, meta.routeId);
  
  const busesByStop = buildBusIndex(vehicles);
  const view = routeViews.get(String(meta.routeId)); 
  if (!view) return;
  
  const { header, routeNumSpan, headsignSpan, metaLineDiv, routeDateSpan, snapshotSpan, stopsList, rowsContainer } = view;
  
  header.style.background = routeColor;
  routeNumSpan.textContent = meta.routeNumber || meta.routeCode || "";
  headsignSpan.textContent = meta.headsign || "";
  metaLineDiv.textContent = "קו " + (meta.routeCode || "");
  routeDateSpan.textContent = meta.routeDate || "";
  
  const snap = meta.lastSnapshot || meta.lastVehicleReport || "-";
  snapshotSpan.textContent = "עדכון: " + (snap.split("T")[1]?.split(".")[0] || snap);
  
  rowsContainer.innerHTML = "";
  stops.forEach((stop, idx) => {
    const row = document.createElement("div"); 
    row.className = "stop-row";
    
    const timeline = document.createElement("div"); 
    timeline.className = "timeline" + (idx===0?" first":"") + (idx===stops.length-1?" last":"");
    timeline.innerHTML = '<div class="timeline-line line-top"></div><div class="timeline-circle" style="border-color:'+routeColor+'"></div><div class="timeline-line line-bottom"></div>';
    
    const main = document.createElement("div"); 
    main.className = "stop-main";
    main.innerHTML = '<div class="stop-name"><span class="seq-num" style="color:'+routeColor+'">'+(idx+1)+'.</span><span>'+stop.stopName+'</span></div><div class="stop-code">'+(stop.stopCode||"")+'</div>';
    
    const buses = (stop.stopCode ? busesByStop.get(String(stop.stopCode)) : []) || [];
    if (buses.length) {
      const busCont = document.createElement("div"); 
      busCont.className = "stop-buses";
      buses.slice(0, 3).forEach(b => {
         const chip = document.createElement("div"); 
         chip.className = "bus-chip "+classifyMinutes(b.minutes); 
         chip.textContent = formatMinutesLabel(b.minutes); 
         busCont.appendChild(chip);
      });
      main.appendChild(busCont);
    }
    
    row.append(timeline, main); 
    rowsContainer.appendChild(row);
  });
  
  // עדכון אייקוני אוטובוס על המסלול
  updateBusIconsForRoute(String(meta.routeId), vehicles, rowsContainer, routeColor);
});
}

// ===== UPDATE PARTIAL - עדכון רק של מיקומי אוטובוסים =====
function updateVehiclePositionsOnly(newPayloads) {
newPayloads.forEach((payload) => {
  const meta = payload.meta || {};
  const routeIdStr = String(meta.routeId);
  const vehicles = payload.vehicles || [];
  const operatorColor = meta.operatorColor || "#1976d2";
  const routeColor = getRouteVariationColor(operatorColor, meta.routeId);
  
  const view = routeViews.get(routeIdStr);
  if (!view) return;
  
  const { rowsContainer, stopsList } = view;
  
  // עדכון אייקוני אוטובוס בלבד
  updateBusIconsForRoute(routeIdStr, vehicles, rowsContainer, routeColor);
  
  // עדכון מיקומי אוטובוס על המפה (partial update)
  updateMapVehiclePositions(meta, vehicles, payload.stops, payload.shapeCoords);
});
}

// ===== עדכון אייקוני אוטובוס על המסלול =====
function updateBusIconsForRoute(routeIdStr, vehicles, rowsContainer, routeColor) {
const stopsList = document.getElementById(\`stops-list-\${routeIdStr}\`);
if (!stopsList) return;

// מחיקת אייקונים ישנים
stopsList.querySelectorAll(".bus-icon").forEach(e => e.remove());

const h = rowsContainer.offsetHeight;
vehicles.forEach(v => {
  const pos = v.positionOnLine; 
  if (pos == null || isNaN(pos)) return;
  
  let y = pos * h; 
  if (y < 10) y = 10; 
  if (y > h - 15) y = h - 15;
  
  const icon = document.createElement("div"); 
  icon.className = "bus-icon material-symbols-outlined"; 
  icon.textContent = "directions_bus";
  icon.style.top = y + "px"; 
  icon.style.color = routeColor; 
  stopsList.appendChild(icon);
});
}

// ===== עדכון מיקומי אוטובוס על המפה =====
function updateMapVehiclePositions(meta, vehicles, stops, shapeCoords) {
const shapeLatLngs = (Array.isArray(shapeCoords) ? shapeCoords : [])
  .map(c => Array.isArray(c) && c.length >= 2 ? [c[1], c[0]] : null)
  .filter(Boolean);

vehicles.forEach(v => {
  const markerKey = \`\${meta.routeId}-\${v.vehicleId}\`;
  const marker = mapBusMarkers.get(markerKey);
  
  if (marker && typeof v.positionOnLine === "number" && shapeLatLngs.length) {
    const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
    const newLl = shapeLatLngs[idx];
    
    if (newLl) {
      // עדכון מיקום marker
      marker.setLatLng(newLl);
      
      // חישוב heading חדש וחץ
      let heading = 0;
      if (idx < shapeLatLngs.length - 1) {
        const nextLl = shapeLatLngs[idx + 1];
        const dLat = nextLl[0] - newLl[0];
        const dLon = nextLl[1] - newLl[1];
        heading = Math.atan2(dLon, dLat) * 180 / Math.PI;
      }
      
      // עדכון הhtml של ה-marker עם הפוזיציה החדשה והחץ
      const operatorColor = meta.operatorColor || "#1976d2";
      const routeColor = getRouteVariationColor(operatorColor, meta.routeId);
      const routeNum = v.routeNumber || "";
      
      const iconHtml = \`
        <div class="bus-marker-container">
          <div class="main-bus-icon" style="background:\${routeColor};">
            <span class="material-symbols-outlined">directions_bus</span>
          </div>
          \${routeNum ? \`<div class="route-badge" style="color:\${routeColor};">\${routeNum}</div>\` : ''}
          \${createDirectionArrowSVG(heading)}
        </div>
      \`;
      
      marker.setIcon(L.divIcon({
        html: iconHtml,
        className: "",
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      }));
    }
  }
});
}

// ===== עדכון נתונים מ-WebView =====
window.updateData = function(newP) { 
  payloads = Array.isArray(newP) ? newP : []; 
  
  if (!initialized) {
    // הפעם ראשונה - render מלא
    renderAll();
  } else {
    // פעמים הבאות - update חלקי בלבד (ביצועים משופרים!)
    updateVehiclePositionsOnly(payloads);
  }
};
</script></body></html>`;
};