// app.js

let mapInstance = null;
let busLayerGroup = null;
let userLocationMarker = null;
let staticDataStore = new Map();
let routeViews = new Map();
let mapDidInitialFit = false;

// 🆕 משתנים למצב דואלי
let nearbyStopsData = [];

const IS_LOCAL = window.APP_ENVIRONMENT === 'local';
const PROXY_URL = "https://script.google.com/macros/s/AKfycbxKfWtTeeoOJCoR_WD4JQhvDGHcE3j82tVHVQXqElwL9NVO9ourZxSHTA20GoBJKfmiLw/exec";

// --- פונקציות עזר (fetch, getUserLocation) ---
async function fetchJson(url) {
  try {
    if (IS_LOCAL) {
      const proxyUrl = PROXY_URL + "?url=" + encodeURIComponent(url);
      const response = await fetch(proxyUrl);
      return await response.json();
    } else {
      const response = await fetch(url);
      return await response.json();
    }
  } catch (e) {
    console.error("Fetch error:", e);
    throw e;
  }
}

async function getUserLocation() {
  if (IS_LOCAL) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        error => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  } else {
    return null; 
  }
}

// --- אתחול ---
document.addEventListener('DOMContentLoaded', async function() {
    initBottomSheet();
    
    // 🆕 אתחול כפתור מצבים
    setupModeToggle();

    // יצירת מפה
    mapInstance = L.map("map", { zoomControl: false }).setView([32.08, 34.78], 13);
    L.control.zoom({ position: 'topright' }).addTo(mapInstance);
    L.tileLayer("https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: ""
    }).addTo(mapInstance);
    
    busLayerGroup = L.layerGroup().addTo(mapInstance);
    busLayerGroup.setZIndex(1000);

    // app.js - בתוך ה-Event Listener של DOMContentLoaded

    const locateBtn = document.getElementById('locateMeBtn');
    if (locateBtn) {
        locateBtn.addEventListener('click', async () => {
            // חיווי ויזואלי לטעינה
            const originalIcon = locateBtn.textContent;
            locateBtn.textContent = '⏳';
            
            try {
                // ננסה לקבל מיקום עדכני (עובד בדפדפן, ולפעמים ב-WebView)
                const location = await getUserLocation();
                
                if (location) {
                    console.log("Updated location:", location);
                    window.setUserLocation(location.latitude, location.longitude);
                    centerOnUser();
                } else {
                    // אם לא קיבלנו מיקום חדש, נתמקד בקיים
                    centerOnUser();
                }
            } catch (e) {
                console.log("Could not refresh location, using last known:", e);
                centerOnUser(); // Fallback: התמקדות במיקום שהגיע מ-main.js
            } finally {
                // החזרת האייקון
                setTimeout(() => {
                    locateBtn.textContent = originalIcon;
                }, 500);
            }
        });
    }

    if (IS_LOCAL) await initLocalMode();
});

// 🆕 לוגיקה למצב דואלי
function setupModeToggle() {
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
            // תיקון גודל מפה לאחר האנימציה
            setTimeout(() => mapInstance && mapInstance.invalidateSize(), 450);
        });
    });
}

// 🆕 פונקציה שמקבלת את התחנות מ-main.js
window.initNearbyStops = function(stops) {
    if (!Array.isArray(stops)) return;
    nearbyStopsData = stops;
    renderNearbyStopsPanel();
};

function renderNearbyStopsPanel() {
    const container = document.getElementById('nearbyStopsList');
    if(!container) return;
    container.innerHTML = '';

    if (nearbyStopsData.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">לא נמצאו תחנות קרובות</div>';
        return;
    }

    nearbyStopsData.forEach((stop, index) => {
        const div = document.createElement('div');
        // התחנה הראשונה תהיה פתוחה (active) כברירת מחדל
        div.className = `stop-bubble ${index === 0 ? 'active' : ''}`;
        div.id = `bubble-${stop.stopCode}`;
        div.onclick = (e) => toggleStopBubble(div, e);

        // חישוב מרחק גס לתצוגה (אופציונלי, ב-main זה d^2)
        // לצורך הפשטות נציג רק קוד ושם
        
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
        container.appendChild(div);
    });
}

function toggleStopBubble(el, event) {
    // אם רוצים שרק אחד יהיה פתוח בו זמנית:
    document.querySelectorAll('.stop-bubble').forEach(b => {
        if(b !== el) b.classList.remove('active');
    });
    el.classList.toggle('active');
    
    // גלילה לאלמנט
    setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
}

// 🆕 עדכון זמנים בבועות (נקרא מתוך updateRealtimeData)
function updateNearbyPanelTimes(updates) {
    const arrivalsByStop = new Map();

    updates.forEach(u => {
        if (!u.vehicles) return;
        u.vehicles.forEach(v => {
            if (!v.onwardCalls) return;
            v.onwardCalls.forEach(call => {
                const sc = String(call.stopCode);
                // האם התחנה הזו קיימת בפאנל?
                const stopContainer = document.getElementById(`times-${sc}`);
                if (stopContainer) {
                    if (!arrivalsByStop.has(sc)) arrivalsByStop.set(sc, []);
                    
                    const etaDate = new Date(call.eta);
                    const minutes = Math.round((etaDate - new Date()) / 60000);
                    
                    // נציג רק מה שעכשיו או בעתיד
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

    // רינדור התוצאות
    arrivalsByStop.forEach((list, stopCode) => {
        const container = document.getElementById(`times-${stopCode}`);
        if (!container) return;

        // מיון לפי זמן
        list.sort((a, b) => a.min - b.min);
        // הסרת כפילויות (אותו קו באותה דקה) - אופציונלי
        
        const topBuses = list.slice(0, 10); // הצג עד 10 קרובים

        if (topBuses.length === 0) {
            container.innerHTML = '<div style="text-align:center; font-size:12px; padding:10px;">אין צפי קרוב</div>';
            return;
        }

        container.innerHTML = topBuses.map(item => {
            let timeText = item.min <= 0 ? 'כעת' : `${item.min} דק'`;
            let etaTime = item.eta.split('T')[1].substring(0,5);
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
    });
}

// --- שאר הפונקציות (initLocalMode, initStaticData...) ---

async function initLocalMode() {
    // ... (אותו קוד כמו בקובץ המקורי) ...
    // רק להוסיף קריאה ל-initNearbyStops דמה אם צריך
}

window.initStaticData = function(payloads) {
    if (!Array.isArray(payloads)) return;
    
    const allLatLngs = [];
    payloads.forEach(p => {
        const routeId = String(p.meta.routeId);
        staticDataStore.set(routeId, p);
        const color = getVariedColor(p.meta.operatorColor || "#1976d2", routeId);
        
        if (p.shapeCoords && p.shapeCoords.length) {
            const latLngs = p.shapeCoords.map(c => [c[1], c[0]]);
            L.polyline(latLngs, { weight: 4, opacity: 0.8, color: color }).addTo(mapInstance);
            latLngs.forEach(ll => allLatLngs.push(ll));
        }
        if (p.stops) {
            p.stops.forEach(s => {
                if (s.lat && s.lon) {
                    L.circleMarker([s.lat, s.lon], { radius: 3, weight: 1, color: "#666", fillColor: "#fff", fillOpacity: 1 })
                    .bindTooltip(s.stopName, { direction: "top", offset: [0, -4] }).addTo(mapInstance);
                }
            });
        }
        createRouteCard(routeId, p.meta, p.stops, color);
    });

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
            drawBuses(u.vehicles, color, staticData.shapeCoords);
        }
    });

    // 🆕 עדכון הפאנל הצדדי
    updateNearbyPanelTimes(updates);
};

// ... (שאר הפונקציות: drawBuses, createRouteCard, updateCardData, getVariedColor, setUserLocation, centerOnUser, initBottomSheet - ללא שינוי) ...
function drawBuses(vehicles, color, shapeCoords) {
    // ... (אותו קוד מקורי) ...
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
              <div class="bus-marker-container">
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
        rowsContainer: rowsContainer
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
                let txt = m + " דק׳";
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
    }
}
function initBottomSheet() {
    const sheet = document.getElementById('bottomSheet');
    if(!sheet) return;
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
