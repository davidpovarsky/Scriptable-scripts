// app.js
// תומך גם ב-Scriptable WebView וגם בדפדפן רגיל

let mapInstance = null;
let busLayerGroup = null;
let userLocationMarker = null;
let staticDataStore = new Map();
let routeViews = new Map();
let mapDidInitialFit = false;

// זיהוי סביבת הריצה
const IS_LOCAL = window.APP_ENVIRONMENT === 'local';
const PROXY_URL = "https://script.google.com/macros/s/AKfycbxKfWtTeeoOJCoR_WD4JQhvDGHcE3j82tVHVQXqElwL9NVO9ourZxSHTA20GoBJKfmiLw/exec";

// פונקציית fetch מותאמת לסביבה
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

// פונקציית מיקום מותאמת לסביבה
async function getUserLocation() {
  if (IS_LOCAL) {
    // דפדפן רגיל - שימוש ב-Geolocation API
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        error => {
          console.error("Geolocation error:", error);
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  } else {
    // Scriptable - המיקום כבר מועבר דרך setUserLocation
    return null;
  }
}

// --- אתחול ---
document.addEventListener('DOMContentLoaded', async function() {
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
    if (locateBtn) {
        locateBtn.addEventListener('click', async () => {
            if (IS_LOCAL) {
                // דפדפן - נבקש מיקום מהמשתמש
                try {
                    locateBtn.textContent = '⏳';
                    const location = await getUserLocation();
                    if (location) {
                        window.setUserLocation(location.latitude, location.longitude);
                        centerOnUser();
                    }
                } catch (e) {
                    alert("לא ניתן לקבל מיקום: " + e.message);
                } finally {
                    locateBtn.textContent = '📍';
                }
            } else {
                // Scriptable - המיקום כבר זמין
                centerOnUser();
            }
        });
    }

    // אם זה Local, נטען נתונים ידנית
    if (IS_LOCAL) {
        await initLocalMode();
    }
});

// אתחול במצב Local
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

// --- 1. טעינת נתונים סטטיים (נקרא פעם אחת בלבד) ---
window.initStaticData = function(payloads) {
    if (!Array.isArray(payloads)) return;
    
    const allLatLngs = [];

    payloads.forEach(p => {
        const routeId = String(p.meta.routeId);
        staticDataStore.set(routeId, p);
        
        const baseColor = p.meta.operatorColor || "#1976d2";
        const color = getVariedColor(baseColor, routeId);
        
        // 1. צייר קו המסלול
        if (p.shapeCoords && p.shapeCoords.length) {
            const latLngs = p.shapeCoords.map(c => [c[1], c[0]]);
            L.polyline(latLngs, { weight: 4, opacity: 0.8, color: color }).addTo(mapInstance);
            latLngs.forEach(ll => allLatLngs.push(ll));
        }

        // 2. צייר תחנות
        if (p.stops) {
            p.stops.forEach(s => {
                if (s.lat && s.lon) {
                    L.circleMarker([s.lat, s.lon], { 
                        radius: 3, weight: 1, color: "#666", 
                        fillColor: "#fff", fillOpacity: 1 
                    })
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

// --- 2. עדכון זמן אמת ---
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
};

function drawBuses(vehicles, color, shapeCoords) {
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
    } else {
        alert("אין מיקום זמין");
    }
}

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