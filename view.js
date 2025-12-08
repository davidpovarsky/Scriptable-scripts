// view.js
// מכיל את ה-HTML string

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
/* עדכון סגנון האייקון הכללי */
.material-symbols-outlined { font-variation-settings: 'FILL' 1, 'Wght' 600, 'GRAD' 0, 'opsz' 24; font-size: 26px; line-height: 1; }

/* קונטיינר האייקון במפה */
.bus-marker-container { 
    position: relative; 
    width: 34px; height: 34px; 
    display: flex; justify-content: center; align-items: center; 
}

/* --- תיקון החץ: כעת הוא מסתובב סביב המרכז של הקונטיינר --- */
.bus-direction-arrow {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%; /* תופס את כל הגודל כדי להסתובב סביב המרכז */
    display: flex;
    justify-content: center;
    align-items: flex-start; /* מצמיד את ה-SVG לחלק העליון */
    z-index: 1; /* מתחת לעיגול הראשי */
    pointer-events: none;
}

.bus-direction-arrow svg {
    margin-top: -14px; /* דוחף את החץ החוצה מעל העיגול */
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}

/* העיגול הראשי הצבעוני */
.main-bus-icon { 
    width: 34px; height: 34px; 
    border-radius: 50%; 
    display: flex; align-items: center; justify-content: center; 
    color: #fff; 
    box-shadow: 0 2px 5px rgba(0,0,0,0.4); 
    border: 2px solid #fff; 
    box-sizing: border-box; 
    z-index: 10; /* מעל החץ */
    position: relative;
}
.main-bus-icon .material-symbols-outlined { font-size: 20px; }

/* התגית הקטנה עם מספר הקו */
.route-badge { position: absolute; top: -6px; right: -6px; background: #fff; border-radius: 99px; height: 18px; min-width: 18px; padding: 0 3px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; border: 2px solid currentColor; box-sizing: border-box; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 20; }

/* איפוס ועיצוב בסיסי */
:root { color-scheme: light dark; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f4f4; color: #111; direction: rtl; overflow: hidden; touch-action: none; }

/* המפה תופסת את כל המסך ברקע */
#map { width: 100%; height: 100vh; position: absolute; top: 0; left: 0; z-index: 0; }

/* כפתור "מצא אותי" - ממוקם מחדש */
#locateMeBtn { position: absolute; top: 15px; left: 15px; z-index: 500; background: #ffffff; border: none; border-radius: 8px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
#locateMeBtn:active { transform: scale(0.95); background: #f0f0f0; }

/* --- Bottom Sheet Container (המגירה הנגררת) --- */
#bottomSheet { position: absolute; bottom: 0; left: 0; right: 0; background: #fff; z-index: 1000; border-top-left-radius: 20px; border-top-right-radius: 20px; box-shadow: 0 -2px 15px rgba(0,0,0,0.15); display: flex; flex-direction: column; height: 45vh; min-height: 60px; max-height: 95vh; transition: height 0.3s cubic-bezier(0.25, 1, 0.5, 1); }

/* ידית הגרירה */
#dragHandleArea { width: 100%; height: 30px; flex-shrink: 0; display: flex; justify-content: center; align-items: center; cursor: grab; touch-action: none; background: #fff; border-top-left-radius: 20px; border-top-right-radius: 20px; }
.handle-bar { width: 40px; height: 5px; background-color: #e0e0e0; border-radius: 10px; }

/* קונטיינר המסלולים */
#routesContainer { flex: 1; display: flex; flex-direction: row; gap: 12px; padding: 10px; padding-top: 0; overflow-x: auto; overflow-y: hidden; box-sizing: border-box; background: #fff; }

/* כרטיס מסלול מעודכן */
.route-card { background: #fff; border-radius: 12px; border: 1px solid #eee; min-width: 320px; max-width: 420px; display: flex; flex-direction: column; overflow: hidden; height: 100%; }

header { background: #1976d2; color: #fff; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
header .line-main { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
header .route-number { font-weight: 700; font-size: 20px; padding: 2px 8px; border-radius: 999px; background: rgba(0,0,0,0.25); }
header .headsign { font-size: 15px; font-weight: 500; }
header .sub { font-size: 11px; opacity: 0.9; display: flex; justify-content: space-between; gap: 10px; }
.stops-list { background: #fff; position: relative; overflow-y: auto; overflow-x: hidden; padding: 0; padding-bottom: 20px; transform: translate3d(0,0,0); flex: 1; max-height: calc(100vh - 400px); }
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
<div id="map">
    <button id="locateMeBtn" title="התמקדות למיקום שלי">📍</button>
</div>

<div id="bottomSheet">
    <div id="dragHandleArea">
        <div class="handle-bar"></div>
    </div>
    <div id="routesContainer"></div>
    <div class="footer-note-global">המיקום מוערך ע"י המערכת (ETA) • המפה מבוססת על מסלולי shape של KavNav.</div>
</div>

<div class="footer-note-global">המיקום מוערך ע"י המערכת (ETA) • המפה מבוססת על מסלולי shape של KavNav.</div>
<script>
let payloads = []; let initialized = false; const routeViews = new Map();
let mapInstance = null; let mapRouteLayers = []; let mapDidInitialFit = false; let mapBusLayers = [];
let allStopsLayer = null;

// מיקום משתמש
let userLocation = null;
let userLocationMarker = null;

document.addEventListener('DOMContentLoaded', function() {
    // אתחול גרירה
    initBottomSheet();
    
    // כפתור מצא אותי
    const locateBtn = document.getElementById('locateMeBtn');
    if (locateBtn) {
        locateBtn.addEventListener('click', () => {
          if (userLocation && typeof userLocation.lat === "number" && typeof userLocation.lon === "number") {
            focusMapOnUser(userLocation.lat, userLocation.lon);
          } else { console.warn("אין מיקום משתמש זמין למיקוד."); }
        });
    }
});

// --- לוגיקת גרירת המגירה ---
function initBottomSheet() {
    const sheet = document.getElementById('bottomSheet');
    const handle = document.getElementById('dragHandleArea');
    
    const SNAP_MIN = 60; // מצב ממוזער
    const SNAP_MID_PERCENT = 0.45; // מצב אמצע (45%)
    const SNAP_MAX_PERCENT = 0.90; // מצב מלא (90%)

    let startY = 0;
    let startHeight = 0;
    let isDragging = false;

    handle.addEventListener('touchstart', (e) => {
        isDragging = true;
        startY = e.touches[0].clientY;
        startHeight = sheet.getBoundingClientRect().height;
        sheet.style.transition = 'none'; // ללא אנימציה בזמן גרירה
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault(); 
        const currentY = e.touches[0].clientY;
        const delta = startY - currentY;
        let newHeight = startHeight + delta;
        
        const maxH = window.innerHeight * 0.95;
        if (newHeight < SNAP_MIN) newHeight = SNAP_MIN;
        if (newHeight > maxH) newHeight = maxH;
        
        sheet.style.height = newHeight + "px";
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        sheet.style.transition = 'height 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
        
        const currentHeight = sheet.getBoundingClientRect().height;
        const windowHeight = window.innerHeight;
        const midPoint = windowHeight * SNAP_MID_PERCENT;
        const maxPoint = windowHeight * SNAP_MAX_PERCENT;
        
        // חישוב לאן לקפוץ
        const distToMin = Math.abs(currentHeight - SNAP_MIN);
        const distToMid = Math.abs(currentHeight - midPoint);
        const distToMax = Math.abs(currentHeight - maxPoint);
        const min = Math.min(distToMin, distToMid, distToMax);
        
        let targetHeight;
        if (min === distToMin) targetHeight = SNAP_MIN;
        else if (min === distToMid) targetHeight = midPoint;
        else targetHeight = maxPoint;
        
        sheet.style.height = targetHeight + "px";
    });
}

// פונקציה שממקד את המפה למיקום המשתמש ומצייר עיגול פשוט
function focusMapOnUser(lat, lon) {
  if (!mapInstance) return;
  if (typeof lat !== "number" || typeof lon !== "number") return;

  const latLng = [lat, lon];

  if (userLocationMarker) {
    try { mapInstance.removeLayer(userLocationMarker); } catch (e) {}
    userLocationMarker = null;
  }

  userLocationMarker = L.circleMarker(latLng, {
    radius: 8,
    color: "#1976d2",
    weight: 2,
    fillColor: "#1976d2",
    fillOpacity: 0.5
  }).addTo(mapInstance);

  mapInstance.setView(latLng, 16);
}

// פונקציה שסקריפט Scriptable יקרא אליה כדי להגדיר את מיקום המשתמש
window.setUserLocation = function(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return;
  userLocation = { lat, lon };
};

function buildBusIndex(vehicles) {
  const byStop = new Map(); const now = new Date();
  for (const v of vehicles) {
    const calls = Array.isArray(v.onwardCalls) ? v.onwardCalls : [];
    for (const c of calls) {
      if (!c || !c.stopCode || !c.eta) continue;
      const stopCode = String(c.stopCode); const etaDate = new Date(c.eta);
      let minutes = Math.round((etaDate.getTime() - now.getTime()) / 60000);
      if (minutes < -2) continue;
      if (!byStop.has(stopCode)) byStop.set(stopCode, []);
      byStop.get(stopCode).push({ minutes });
    }
  }
  for (const arr of byStop.values()) { arr.sort((a, b) => a.minutes - b.minutes); }
  return byStop;
}

function classifyMinutes(m) { if (m <= 3) return "bus-soon"; if (m <= 7) return "bus-mid"; if (m <= 15) return "bus-far"; return "bus-late"; }
function formatMinutesLabel(m) { return m <= 0 ? "כעת" : m + " דק׳"; }

function ensureLayout(allPayloads) {
  if (initialized) return;
  const container = document.getElementById("routesContainer"); container.innerHTML = "";
  allPayloads.forEach((p) => {
    const meta = p.meta || {}; const routeIdStr = String(meta.routeId);
    const card = document.createElement("div"); card.className = "route-card";
    const header = document.createElement("header");
    const lineMain = document.createElement("div"); lineMain.className = "line-main";
    const leftDiv = document.createElement("div");
    const routeNumSpan = document.createElement("span"); routeNumSpan.className = "route-number";
    const headsignSpan = document.createElement("span"); headsignSpan.className = "headsign";
    leftDiv.append(routeNumSpan, headsignSpan);
    const metaLineDiv = document.createElement("div"); metaLineDiv.style.fontSize = "12px"; metaLineDiv.style.opacity = "0.9";
    lineMain.append(leftDiv, metaLineDiv);
    
    const subDiv = document.createElement("div"); subDiv.className = "sub";
    const routeDateSpan = document.createElement("span"); 
    const snapshotSpan = document.createElement("span"); snapshotSpan.textContent = "עדכון: -";
    subDiv.append(routeDateSpan, snapshotSpan);
    
    header.append(lineMain, subDiv);
    
    const stopsList = document.createElement("div"); stopsList.className = "stops-list";
    const rowsContainer = document.createElement("div"); rowsContainer.className = "stops-rows";
    stopsList.appendChild(rowsContainer);
    
    card.append(header, stopsList);
    container.appendChild(card);
    
    routeViews.set(routeIdStr, { card, header, routeNumSpan, headsignSpan, metaLineDiv, routeDateSpan, snapshotSpan, stopsList, rowsContainer });
  });
  initialized = true;
}

// 💡 פונקציה משופרת לייצור גוון ייחודי וחזק יותר
function getVariedColor(baseColor, idStr) {
    let c = baseColor.replace('#', '');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    let r = parseInt(c.substring(0,2), 16);
    let g = parseInt(c.substring(2,4), 16);
    let b = parseInt(c.substring(4,6), 16);

    let hash = 0;
    for (let i = 0; i < idStr.length; i++) {
        hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // יצירת שינוי חזק יותר (בין -60 ל +60)
    const variance = (hash % 120) - 60; 
    
    // שינוי ה-Tint (לא רק בהירות) ע"י השפעה שונה על הערוצים
    // אם ה-Hash זוגי, נחזק אדום ונחליש ירוק, וכו'
    if (hash % 2 === 0) {
        r += variance;
        g -= variance / 2;
        b += variance / 3;
    } else {
        r -= variance / 2;
        g += variance;
        b -= variance / 3;
    }

    const clamp = (num) => Math.min(255, Math.max(0, Math.round(num)));
    r = clamp(r); g = clamp(g); b = clamp(b);

    const toHex = (n) => n.toString(16).padStart(2, '0');
    return "#" + toHex(r) + toHex(g) + toHex(b);
}

function ensureMapInstance(allPayloads) {
  if (!document.getElementById("map")) return;
  if (!mapInstance) {
    mapInstance = L.map("map");
    L.tileLayer("https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: ""
    }).addTo(mapInstance);

    if (!allStopsLayer && window.stopsDataJson) {
      try {
        const stops = JSON.parse(window.stopsDataJson || "[]");
        allStopsLayer = L.layerGroup().addTo(mapInstance);
        stops.forEach(st => {
          const lat = Number(st.lat); const lon = Number(st.lon);
          if (!isFinite(lat) || !isFinite(lon)) return;
          L.circleMarker([lat, lon], { radius: 3, weight: 1, color: "#555", fillColor: "#fff", fillOpacity: 1 })
          .bindTooltip((st.stopName || "") + (st.stopCode ? " (" + st.stopCode + ")" : ""), {direction:"top", offset:[0,-4]})
          .addTo(allStopsLayer);
        });
      } catch (e) { console.error("Error stops:", e); }
    }
  }
  mapRouteLayers.forEach(l => { try { mapInstance.removeLayer(l); } catch (e) {} }); mapRouteLayers = [];
  const allLatLngs = [];

  allPayloads.forEach(p => {
      const meta = p.meta || {}; 
      const baseColor = meta.operatorColor || "#1976d2";
      const routeIdStr = String(meta.routeId);
      
      // שימוש בפונקציית הצבע החדשה
      const specificColor = getVariedColor(baseColor, routeIdStr); 

      const shapeCoords = Array.isArray(p.shapeCoords) ? p.shapeCoords : [];
      const stops = Array.isArray(p.stops) ? p.stops : [];
      const group = L.layerGroup();
      
      if (shapeCoords.length) {
          const latlngs = shapeCoords.map(c => Array.isArray(c) && c.length >= 2 ? [c[1], c[0]] : null).filter(Boolean);
          if (latlngs.length) {
              L.polyline(latlngs, { weight: 4, opacity: 0.85, color: specificColor }).addTo(group);
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

      const vehicles = Array.isArray(p.vehicles) ? p.vehicles : [];
      const shapeLatLngs = shapeCoords.map(c => Array.isArray(c) && c.length >= 2 ? [c[1], c[0]] : null).filter(Boolean);
      
      vehicles.forEach(v => {
          if (typeof v.positionOnLine !== "number" || !shapeLatLngs.length) return;
          const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
          const ll = shapeLatLngs[idx];
          
          if (ll) {
              const routeNum = v.routeNumber || "";
              const bearing = v.bearing || 0; 
              
              // המבנה החדש של האייקון - החץ מסתובב יחד עם הקונטיינר
              const iconHtml = \`
                  <div class="bus-marker-container">
                      <div class="bus-direction-arrow" style="transform: rotate(\${bearing}deg);">
                         <svg viewBox="0 0 24 24" width="24" height="24" fill="\${specificColor}" stroke="white" stroke-width="2">
                            <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
                         </svg>
                      </div>

                      <div class="main-bus-icon" style="background:\${specificColor};">
                          <span class="material-symbols-outlined">directions_bus</span>
                      </div>

                      \${routeNum ? \`<div class="route-badge" style="color:\${specificColor}; border-color:\${specificColor};">\${routeNum}</div>\` : ''}
                  </div>
              \`;
              
              L.marker(ll, {
                  icon: L.divIcon({
                      html: iconHtml,
                      className: "",
                      iconSize: [34, 34],
                      iconAnchor: [17, 17] // מרכז מדויק
                  }),
                  zIndexOffset: 1000
              }).addTo(group);
          }
      });

      group.addTo(mapInstance); mapRouteLayers.push(group);
  });
  if (allLatLngs.length && !mapDidInitialFit) { mapInstance.fitBounds(allLatLngs, { padding: [20, 20] }); mapDidInitialFit = true; }
}

function renderAll() {
  if (!payloads || !payloads.length) return;
  ensureLayout(payloads);
  ensureMapInstance(payloads);
  payloads.forEach((payload) => {
    const meta = payload.meta || {}; const stops = payload.stops || []; const vehicles = payload.vehicles || [];
    const busesByStop = buildBusIndex(vehicles);
    const view = routeViews.get(String(meta.routeId)); if (!view) return;
    const { header, routeNumSpan, headsignSpan, metaLineDiv, routeDateSpan, snapshotSpan, stopsList, rowsContainer } = view;

    // צבע ייחודי גם לכרטיס
    const baseColor = meta.operatorColor || "#1976d2";
    const specificColor = getVariedColor(baseColor, String(meta.routeId));

    header.style.background = specificColor;
    routeNumSpan.textContent = meta.routeNumber || meta.routeCode || "";
    headsignSpan.textContent = meta.headsign || "";
    metaLineDiv.textContent = "קו " + (meta.routeCode || "");
    routeDateSpan.textContent = meta.routeDate || "";
    const snap = meta.lastSnapshot || meta.lastVehicleReport || "-";
    snapshotSpan.textContent = "עדכון: " + (snap.split("T")[1]?.split(".")[0] || snap);
    
    rowsContainer.innerHTML = "";
    stops.forEach((stop, idx) => {
      const row = document.createElement("div"); row.className = "stop-row";
      const timeline = document.createElement("div"); timeline.className = "timeline" + (idx===0?" first":"") + (idx===stops.length-1?" last":"");
      timeline.innerHTML = '<div class="timeline-line line-top"></div><div class="timeline-circle" style="border-color:'+specificColor+'"></div><div class="timeline-line line-bottom"></div>';
      
      const main = document.createElement("div"); main.className = "stop-main";
      main.innerHTML = '<div class="stop-name"><span class="seq-num" style="color:'+specificColor+'">'+(idx+1)+'.</span><span>'+stop.stopName+'</span></div><div class="stop-code">'+(stop.stopCode||"#"+stop.stopSequence)+'</div>';
      
      const buses = (stop.stopCode ? busesByStop.get(String(stop.stopCode)) : []) || [];
      if (buses.length) {
        const busCont = document.createElement("div"); busCont.className = "stop-buses";
        buses.slice(0, 3).forEach(b => {
           const chip = document.createElement("div"); chip.className = "bus-chip "+classifyMinutes(b.minutes); chip.textContent = formatMinutesLabel(b.minutes); busCont.appendChild(chip);
        });
        main.appendChild(busCont);
      }
      row.append(timeline, main); rowsContainer.appendChild(row);
    });
    
    setTimeout(() => {
      stopsList.querySelectorAll(".bus-icon").forEach(e => e.remove());
      const h = rowsContainer.offsetHeight;
      vehicles.forEach(v => {
        const pos = v.positionOnLine; if (pos==null||isNaN(pos)) return;
        let y = pos * h; if (y<10) y=10; if(y>h-15) y=h-15;
        const icon = document.createElement("div"); icon.className = "bus-icon material-symbols-outlined"; icon.textContent = "directions_bus";
        icon.style.top = y + "px"; icon.style.color = specificColor; stopsList.appendChild(icon);
      });
    }, 50);
  });
}

window.updateData = function(newP) { payloads = Array.isArray(newP) ? newP : []; renderAll(); };
</script></body></html>`;
};