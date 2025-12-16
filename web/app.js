-
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