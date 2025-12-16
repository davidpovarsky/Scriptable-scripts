// view.js
// מכיל את ה-HTML string המעודכן עם הפרדת נתונים

module.exports.getHtml = function() {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>מסלולי קווים</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0&icon_names=directions_bus" />
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
<style>
/* --- עיצוב כללי --- */
:root { color-scheme: light dark; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f4f4; color: #111; direction: rtl; overflow: hidden; touch-action: none; }

/* --- מפה --- */
#map { width: 100%; height: 100vh; position: absolute; top: 0; left: 0; z-index: 0; }

/* --- כפתור מיקום --- */
#locateMeBtn { position: absolute; top: 15px; left: 15px; z-index: 500; background: #ffffff; border: none; border-radius: 8px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
#locateMeBtn:active { transform: scale(0.95); background: #f0f0f0; }

/* --- אייקון אוטובוס --- */
.bus-marker-container { position: relative; width: 34px; height: 34px; display: flex; justify-content: center; align-items: center; }
.bus-direction-arrow { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: flex-start; z-index: 1; pointer-events: none; }
.bus-direction-arrow svg { margin-top: -14px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3)); }
.main-bus-icon { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.4); border: 2px solid #fff; box-sizing: border-box; z-index: 10; position: relative; }
.material-symbols-outlined { font-size: 20px; line-height: 1; }
.route-badge { position: absolute; top: -6px; right: -6px; background: #fff; border-radius: 99px; height: 18px; min-width: 18px; padding: 0 3px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; border: 2px solid currentColor; box-sizing: border-box; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 20; }

/* --- Bottom Sheet --- */
#bottomSheet { position: absolute; bottom: 0; left: 0; right: 0; background: #fff; z-index: 1000; border-top-left-radius: 20px; border-top-right-radius: 20px; box-shadow: 0 -2px 15px rgba(0,0,0,0.15); display: flex; flex-direction: column; height: 45vh; min-height: 60px; max-height: 95vh; transition: height 0.3s cubic-bezier(0.25, 1, 0.5, 1); }
#dragHandleArea { width: 100%; height: 30px; flex-shrink: 0; display: flex; justify-content: center; align-items: center; cursor: grab; touch-action: none; background: #fff; border-top-left-radius: 20px; border-top-right-radius: 20px; }
.handle-bar { width: 40px; height: 5px; background-color: #e0e0e0; border-radius: 10px; }
#routesContainer { flex: 1; display: flex; flex-direction: row; gap: 12px; padding: 10px; padding-top: 0; overflow-x: auto; overflow-y: hidden; box-sizing: border-box; background: #fff; }

/* --- כרטיס מסלול --- */
.route-card { background: #fff; border-radius: 12px; border: 1px solid #eee; min-width: 320px; max-width: 420px; display: flex; flex-direction: column; overflow: hidden; height: 100%; }
header { background: #1976d2; color: #fff; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
header .line-main { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
header .route-number { font-weight: 700; font-size: 20px; padding: 2px 8px; border-radius: 999px; background: rgba(0,0,0,0.25); }
header .headsign { font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
header .sub { font-size: 11px; opacity: 0.9; display: flex; justify-content: space-between; gap: 10px; }

/* --- רשימת תחנות --- */
.stops-list { background: #fff; position: relative; overflow-y: auto; overflow-x: hidden; padding: 0; padding-bottom: 20px; flex: 1; }
.stops-rows { width: 100%; }
.stop-row { display: flex; flex-direction: row; align-items: stretch; gap: 0; min-height: 50px; }
.timeline { width: 50px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; position: relative; }
.timeline-line { width: 4px; background: #e0e0e0; flex: 1; }
.timeline-circle { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 3px solid #1976d2; box-sizing: border-box; z-index: 2; margin: -2px 0; }
.timeline.first .line-top { visibility: hidden; }
.timeline.last .line-bottom { visibility: hidden; }
.stop-main { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 8px 10px 8px 0; border-bottom: 1px solid #f0f0f0; }
.stop-name { font-size: 14px; font-weight: 600; display: flex; gap: 4px; }
.seq-num { color: #1976d2; font-weight: 700; min-width: 20px; font-size: 12px; }
.stop-code { font-size: 11px; color: #777; margin-right: 24px; }
.stop-buses { margin-top: 6px; margin-right: 24px; display: flex; flex-wrap: wrap; gap: 4px; min-height: 18px; }

/* --- תגיות זמן --- */
.bus-chip { border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; }
.bus-soon { background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; }
.bus-mid  { background: #fffde7; color: #f9a825; border: 1px solid #fff9c4; }
.bus-far  { background: #e1f5fe; color: #0277bd; border: 1px solid #b3e5fc; }
.bus-late { background: #f5f5f5; color: #757575; border: 1px solid #e0e0e0; }

/* --- אוטובוס על הטיימליין --- */
.bus-icon-timeline { position: absolute; right: 25px; font-size: 24px; z-index: 50; pointer-events: none; transform: translate3d(50%, -50%, 0); transition: top 0.5s linear; }

.footer-note-global { margin: 4px 0 10px; font-size: 10px; color: #999; text-align: center; }
</style>
</head>
<body>
<div id="map"><button id="locateMeBtn" title="המיקום שלי">📍</button></div>
<div id="bottomSheet">
    <div id="dragHandleArea"><div class="handle-bar"></div></div>
    <div id="routesContainer"></div>
    <div class="footer-note-global">המיקום מוערך ע"י המערכת (ETA) • מבוסס KavNav</div>
</div>

<script>
// --- משתנים גלובליים ---
let mapInstance = null;
let busLayerGroup = null;
let userLocationMarker = null;
let staticDataStore = new Map(); // שומר את המידע הסטטי (תחנות, מסלול)
let routeViews = new Map();      // שומר רפרנסים ל-DOM
let mapDidInitialFit = false;

// --- אתחול ---
document.addEventListener('DOMContentLoaded', function() {
    initBottomSheet();
    // יצירת מפה ראשונית
    mapInstance = L.map("map", { zoomControl: false }).setView([32.08, 34.78], 13);
    L.control.zoom({ position: 'topright' }).addTo(mapInstance);
    L.tileLayer("https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: ""
    }).addTo(mapInstance);
    
    busLayerGroup = L.layerGroup().addTo(mapInstance);
    busLayerGroup.setZIndex(1000);

    const locateBtn = document.getElementById('locateMeBtn');
    if (locateBtn) locateBtn.addEventListener('click', centerOnUser);
});

// --- 1. טעינת נתונים סטטיים (נקרא פעם אחת בלבד) ---
window.initStaticData = function(payloads) {
    if (!Array.isArray(payloads)) return;
    
    const allLatLngs = [];

    payloads.forEach(p => {
        const routeId = String(p.meta.routeId);
        staticDataStore.set(routeId, p);
        
        // צבע הקו
        const baseColor = p.meta.operatorColor || "#1976d2";
        const color = getVariedColor(baseColor, routeId);
        
        // 1. ציור קו המסלול
        if (p.shapeCoords && p.shapeCoords.length) {
            const latLngs = p.shapeCoords.map(c => [c[1], c[0]]); // GeoJSON [lon,lat] -> Leaflet [lat,lon]
            L.polyline(latLngs, { weight: 4, opacity: 0.8, color: color }).addTo(mapInstance);
            latLngs.forEach(ll => allLatLngs.push(ll));
        }

        // 2. ציור תחנות (עיגולים קטנים)
        if (p.stops) {
            p.stops.forEach(s => {
                if (s.lat && s.lon) {
                    L.circleMarker([s.lat, s.lon], { radius: 3, weight: 1, color: "#666", fillColor: "#fff", fillOpacity: 1 })
                    .bindTooltip(s.stopName, { direction: "top", offset: [0, -4] })
                    .addTo(mapInstance);
                }
            });
        }

        // 3. בניית כרטיס HTML
        createRouteCard(routeId, p.meta, p.stops, color);
    });

    // התמקדות ראשונית
    if (allLatLngs.length && !mapDidInitialFit) {
        mapInstance.fitBounds(allLatLngs, { padding: [30, 30] });
        mapDidInitialFit = true;
    }
};

// --- 2. עדכון זמן אמת (נקרא כל 10 שניות) ---
window.updateRealtimeData = function(updates) {
    if (!busLayerGroup) return;
    busLayerGroup.clearLayers(); // מחיקת אוטובוסים קודמים

    updates.forEach(u => {
        const routeId = String(u.routeId);
        const staticData = staticDataStore.get(routeId);
        if (!staticData) return;

        const color = getVariedColor(staticData.meta.operatorColor || "#1976d2", routeId);
        
        // עדכון כרטיס המידע (זמנים ומיקום בטיימליין)
        updateCardData(routeId, u, staticData.stops, color);

        // ציור אוטובוסים על המפה
        if (u.vehicles && u.vehicles.length) {
            drawBuses(u.vehicles, color, staticData.shapeCoords);
        }
    });
};

// --- לוגיקה גרפית ---

function drawBuses(vehicles, color, shapeCoords) {
    // הכנת מסלול לחישובים אם צריך fallback
    const shapeLatLngs = shapeCoords ? shapeCoords.map(c => [c[1], c[0]]) : [];

    vehicles.forEach(v => {
        let lat = v.lat;
        let lon = v.lon;

        // אם אין GPS, מנסים לחשב לפי מיקום על הקו (Fallback)
        if ((!lat || !lon) && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
            const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
            const point = shapeLatLngs[idx];
            if (point) { lat = point[0]; lon = point[1]; }
        }

        if (lat && lon) {
            const bearing = v.bearing || 0;
            const iconHtml = \`
              <div class="bus-marker-container">
                  <div class="bus-direction-arrow" style="transform: rotate(\${bearing}deg);">
                     <svg viewBox="0 0 24 24" width="24" height="24" fill="\${color}" stroke="white" stroke-width="2">
                        <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
                     </svg>
                  </div>
                  <div class="main-bus-icon" style="background:\${color};">
                      <span class="material-symbols-outlined">directions_bus</span>
                  </div>
                  \${v.routeNumber ? \`<div class="route-badge" style="color:\${color}; border-color:\${color};">\${v.routeNumber}</div>\` : ''}
              </div>\`;
            
            L.marker([lat, lon], {
                icon: L.divIcon({ html: iconHtml, className: "", iconSize: [34, 34], iconAnchor: [17, 17] }),
                zIndexOffset: 1000
            }).addTo(busLayerGroup);
        }
    });
}

function createRouteCard(routeId, meta, stops, color) {
    const container = document.getElementById("routesContainer");
    
    // מעטפת הכרטיס
    const card = document.createElement("div"); 
    card.className = "route-card";
    
    // כותרת
    const header = document.createElement("header");
    header.style.background = color;
    header.innerHTML = \`
        <div class="line-main">
            <div>
                <span class="route-number">\${meta.routeNumber || meta.routeCode}</span>
                <span class="headsign">\${meta.headsign}</span>
            </div>
            <div style="font-size:12px; opacity:0.9">קו \${meta.routeCode}</div>
        </div>
        <div class="sub">
            <span>\${meta.routeDate || ""}</span>
            <span class="last-update-text">ממתין לעדכון...</span>
        </div>
    \`;
    
    // רשימת תחנות
    const stopsList = document.createElement("div"); 
    stopsList.className = "stops-list";
    const rowsContainer = document.createElement("div"); 
    rowsContainer.className = "stops-rows";
    
    stops.forEach((stop, idx) => {
        const row = document.createElement("div"); 
        row.className = "stop-row";
        
        // יצירת קו הזמן (Timeline)
        const isFirst = idx === 0 ? " first" : "";
        const isLast = idx === stops.length - 1 ? " last" : "";
        const timelineHtml = \`
            <div class="timeline-line line-top"></div>
            <div class="timeline-circle" style="border-color:\${color}"></div>
            <div class="timeline-line line-bottom"></div>
        \`;
        
        const timeline = document.createElement("div");
        timeline.className = "timeline" + isFirst + isLast;
        timeline.innerHTML = timelineHtml;
        
        const main = document.createElement("div");
        main.className = "stop-main";
        main.innerHTML = \`
            <div class="stop-name">
                <span class="seq-num" style="color:\${color}">\${idx+1}.</span>
                <span>\${stop.stopName}</span>
            </div>
            <div class="stop-code">\${stop.stopCode || ""}</div>
            <div class="stop-buses" id="buses-\${routeId}-\${stop.stopCode}"></div>
        \`;
        
        row.append(timeline, main);
        rowsContainer.appendChild(row);
    });

    stopsList.appendChild(rowsContainer);
    card.append(header, stopsList);
    container.appendChild(card);
    
    // שמירת רפרנסים לעדכון עתידי
    routeViews.set(routeId, { 
        lastUpdateSpan: header.querySelector(".last-update-text"),
        stopsList: stopsList,
        rowsContainer: rowsContainer,
        rowHeight: 0 // נחשב אח"כ
    });
}

function updateCardData(routeId, updateData, stops, color) {
    const view = routeViews.get(routeId);
    if (!view) return;

    // עדכון טקסט "עודכן לאחרונה"
    const meta = updateData.meta || {};
    const snap = meta.lastSnapshot || meta.lastVehicleReport || new Date().toISOString();
    const timeStr = snap.split("T")[1]?.split(".")[0] || snap;
    view.lastUpdateSpan.textContent = "עדכון: " + timeStr;

    // 1. חישוב זמנים לתחנות (בניית אינדקס)
    const busesByStop = new Map();
    const now = new Date();
    
    (updateData.vehicles || []).forEach(v => {
        if (!v.onwardCalls) return;
        v.onwardCalls.forEach(c => {
            if (!c.stopCode || !c.eta) return;
            const minutes = Math.round((new Date(c.eta) - now) / 60000);
            if (minutes < -1) return; // עבר זמנו
            
            const sc = String(c.stopCode);
            if (!busesByStop.has(sc)) busesByStop.set(sc, []);
            busesByStop.get(sc).push(minutes);
        });
    });

    // עדכון הצ'יפים ברשימה
    stops.forEach(stop => {
        const container = document.getElementById(\`buses-\${routeId}-\${stop.stopCode}\`);
        if (!container) return;
        
        const times = busesByStop.get(String(stop.stopCode));
        if (times && times.length) {
            times.sort((a,b) => a-b);
            container.innerHTML = times.slice(0, 3).map(m => {
                let cls = "bus-late";
                let txt = m + " דק׳";
                if (m <= 0) { txt = "כעת"; cls = "bus-soon"; }
                else if (m <= 5) cls = "bus-soon";
                else if (m <= 10) cls = "bus-mid";
                else if (m <= 20) cls = "bus-far";
                return \`<div class="bus-chip \${cls}">\${txt}</div>\`;
            }).join("");
        } else {
            container.innerHTML = "";
        }
    });

    // 2. הזזת אייקונים על הטיימליין
    // ניקוי ישנים
    view.stopsList.querySelectorAll(".bus-icon-timeline").forEach(e => e.remove());
    
    // חישוב גובה שורה (פעם אחת או דינמי)
    const listHeight = view.rowsContainer.offsetHeight;
    if (listHeight < 50) return; // עדיין לא רונדר

    (updateData.vehicles || []).forEach(v => {
        const pos = v.positionOnLine; 
        if (typeof pos !== "number") return;
        
        let top = pos * listHeight;
        // גבולות גזרה שלא יצא מהרשימה
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

// --- עזרים ---
function getVariedColor(hex, strSalt) {
    // פונקציה ליצירת גוון ייחודי קל
    let c = hex.replace('#','');
    if(c.length===3) c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    let r=parseInt(c.substring(0,2),16), g=parseInt(c.substring(2,4),16), b=parseInt(c.substring(4,6),16);
    let hash=0; for(let i=0;i<strSalt.length;i++) hash=strSalt.charCodeAt(i)+((hash<<5)-hash);
    const v=(hash%60)-30; 
    const clamp=n=>Math.min(255,Math.max(0,Math.round(n+v)));
    return "#" + [clamp(r), clamp(g), clamp(b)].map(x=>x.toString(16).padStart(2,'0')).join("");
}

// --- מיקום משתמש ---
window.setUserLocation = function(lat, lon) {
    if (!mapInstance) return;
    if (userLocationMarker) userLocationMarker.remove();
    userLocationMarker = L.circleMarker([lat, lon], { radius: 8, color: "#1976d2", fillColor: "#2196f3", fillOpacity: 0.6 }).addTo(mapInstance);
};

function centerOnUser() {
    if (userLocationMarker) {
        mapInstance.setView(userLocationMarker.getLatLng(), 16);
    } else {
        alert("אין מיקום זמין");
    }
}

// --- Bottom Sheet ---
function initBottomSheet() {
    const sheet = document.getElementById('bottomSheet');
    const handle = document.getElementById('dragHandleArea');
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
</script>
</body>
</html>`;
};
