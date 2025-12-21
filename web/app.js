// app.js
// תומך גם ב-Scriptable WebView וגם בדפדפן רגיל

let mapInstance = null;
let busLayerGroup = null;
let userLocationMarker = null;
let staticDataStore = new Map();
let routeViews = new Map();
let mapDidInitialFit = false;

// נתונים עבור פאנל תחנות קרובות
let nearbyStopsData = [];
let nearbyStopsRealtimeData = new Map(); // stopCode -> realtime data
let activeStopBubble = null;

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
    return null;
  }
}

// ==========================================
// אתחול
// ==========================================

document.addEventListener('DOMContentLoaded', async function() {
    initBottomSheet();
    initModeToggle();
    
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
                try {
                    locateBtn.textContent = '⏳';
                    const location = await getUserLocation();
                    if (location) {
                        window.setUserLocation(location.latitude, location.longitude);
                        centerOnUser();
                        // רענון תחנות קרובות
                        await loadNearbyStops(location.latitude, location.longitude);
                    }
                } catch (e) {
                    alert("לא ניתן לקבל מיקום: " + e.message);
                } finally {
                    locateBtn.textContent = '📍';
                }
            } else {
                centerOnUser();
            }
        });
    }

    // אם זה Local, נטען נתונים ידנית
    if (IS_LOCAL) {
        await initLocalMode();
    }
});

// ==========================================
// טוגל מצבים (מפה בלבד / כפול)
// ==========================================

function initModeToggle() {
    const mapOnlyBtn = document.getElementById('mapOnlyBtn');
    const dualModeBtn = document.getElementById('dualModeBtn');
    
    mapOnlyBtn.addEventListener('click', () => {
        document.body.classList.remove('dual-mode');
        mapOnlyBtn.classList.add('active');
        dualModeBtn.classList.remove('active');
        
        // רענון המפה כדי להתאים לגודל החדש
        setTimeout(() => {
            if (mapInstance) mapInstance.invalidateSize();
        }, 400);
    });
    
    dualModeBtn.addEventListener('click', () => {
        document.body.classList.add('dual-mode');
        dualModeBtn.classList.add('active');
        mapOnlyBtn.classList.remove('active');
        
        // רענון המפה כדי להתאים לגודל החדש
        setTimeout(() => {
            if (mapInstance) mapInstance.invalidateSize();
        }, 400);
    });
}

// ==========================================
// טעינת תחנות קרובות
// ==========================================

async function loadNearbyStops(lat, lon) {
    const container = document.getElementById('stopsBubblesContainer');
    const locationInfo = document.getElementById('locationInfo');
    
    container.innerHTML = '<div class="loading-message">מחפש תחנות קרובות...</div>';
    locationInfo.textContent = `מיקום: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    
    try {
        // חישוב מרחק פשוט
        function distance(lat1, lon1, lat2, lon2) {
            const R = 6371; // רדיוס כדור הארץ בק"מ
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }
        
        // טעינת stops.json אם זמין
        let allStops = [];
        if (window.stopsDataJson) {
            try {
                allStops = JSON.parse(window.stopsDataJson);
            } catch (e) {
                console.error("Error parsing stops.json:", e);
            }
        }
        
        // חישוב מרחקים ומציאת 5 הקרובות ביותר
        const stopsWithDistance = allStops
            .filter(s => s && s.lat && s.lon && s.stopCode)
            .map(s => ({
                ...s,
                distance: distance(lat, lon, s.lat, s.lon)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);
        
        nearbyStopsData = stopsWithDistance;
        
        if (stopsWithDistance.length === 0) {
            container.innerHTML = '<div class="no-data-message">לא נמצאו תחנות קרובות</div>';
            return;
        }
        
        // בניית הבועות
        renderStopBubbles(stopsWithDistance);
        
        // טעינת זמן אמת לתחנות
        await loadRealtimeForNearbyStops(stopsWithDistance);
        
    } catch (e) {
        console.error("Error loading nearby stops:", e);
        container.innerHTML = '<div class="no-data-message">שגיאה בטעינת תחנות</div>';
    }
}

function renderStopBubbles(stops) {
    const container = document.getElementById('stopsBubblesContainer');
    container.innerHTML = '';
    
    stops.forEach((stop, index) => {
        const bubble = document.createElement('div');
        bubble.className = 'stop-bubble';
        bubble.dataset.stopCode = stop.stopCode;
        
        const distanceText = stop.distance < 1 
            ? `${Math.round(stop.distance * 1000)}מ׳`
            : `${stop.distance.toFixed(1)}ק״מ`;
        
        bubble.innerHTML = `
            <div class="stop-bubble-header">
                <div class="stop-bubble-title">
                    <div class="stop-bubble-name">
                        <span class="stop-rank">${index + 1}</span>
                        <span>${stop.stopName || stop.name || 'תחנה ללא שם'}</span>
                    </div>
                    <div class="stop-bubble-code">קוד: ${stop.stopCode}</div>
                </div>
                <div class="stop-distance">${distanceText}</div>
            </div>
            <div class="stop-routes-preview" id="routes-preview-${stop.stopCode}">
                <div style="font-size: 12px; color: #999;">טוען קווים...</div>
            </div>
            <div class="stop-details">
                <div class="stop-arrivals" id="arrivals-${stop.stopCode}">
                    <div style="font-size: 13px; color: #999; text-align: center; padding: 10px;">
                        טוען זמני הגעה...
                    </div>
                </div>
            </div>
        `;
        
        bubble.addEventListener('click', () => toggleStopBubble(bubble, stop));
        container.appendChild(bubble);
    });
}

function toggleStopBubble(bubble, stop) {
    // אם זה כבר פתוח - נסגור
    if (bubble.classList.contains('active')) {
        bubble.classList.remove('active');
        activeStopBubble = null;
        return;
    }
    
    // נסגור את כל האחרים
    document.querySelectorAll('.stop-bubble.active').forEach(b => {
        b.classList.remove('active');
    });
    
    // נפתח את זה
    bubble.classList.add('active');
    activeStopBubble = bubble;
    
    // מרכוז המפה על התחנה
    if (mapInstance && stop.lat && stop.lon) {
        mapInstance.setView([stop.lat, stop.lon], 16, { animate: true });
    }
}

// ==========================================
// טעינת זמן אמת לתחנות קרובות
// ==========================================

async function loadRealtimeForNearbyStops(stops) {
    for (const stop of stops) {
        try {
            const API_BASE = "https://kavnav.com/api";
            const url = `${API_BASE}/realtime?stopCode=${encodeURIComponent(stop.stopCode)}`;
            const realtimeData = await fetchJson(url);
            
            nearbyStopsRealtimeData.set(stop.stopCode, realtimeData);
            updateStopBubbleRealtime(stop.stopCode, realtimeData);
            
        } catch (e) {
            console.error(`Error loading realtime for stop ${stop.stopCode}:`, e);
        }
    }
}

function updateStopBubbleRealtime(stopCode, realtimeData) {
    const routesPreview = document.getElementById(`routes-preview-${stopCode}`);
    const arrivalsContainer = document.getElementById(`arrivals-${stopCode}`);
    
    if (!routesPreview || !arrivalsContainer) return;
    
    const vehicles = Array.isArray(realtimeData.vehicles) ? realtimeData.vehicles : [];
    
    if (vehicles.length === 0) {
        routesPreview.innerHTML = '<div style="font-size: 11px; color: #999;">אין נתוני זמן אמת</div>';
        arrivalsContainer.innerHTML = '<div style="font-size: 13px; color: #999; text-align: center; padding: 10px;">אין זמני הגעה זמינים</div>';
        return;
    }
    
    // קיבוץ לפי קו
    const routesMap = new Map();
    const now = new Date();
    
    vehicles.forEach(v => {
        if (!v.trip || !v.trip.gtfsInfo) return;
        
        const routeNumber = v.trip.gtfsInfo.routeNumber || v.trip.routeCode || '?';
        const headsign = v.trip.gtfsInfo.headsign || '';
        const key = `${routeNumber}-${headsign}`;
        
        if (!routesMap.has(key)) {
            routesMap.set(key, {
                routeNumber,
                headsign,
                times: []
            });
        }
        
        // מציאת זמני הגעה לתחנה הזו
        const calls = v.trip.onwardCalls?.calls || [];
        calls.forEach(c => {
            if (String(c.stopCode) === String(stopCode) && c.eta) {
                const minutes = Math.round((new Date(c.eta) - now) / 60000);
                if (minutes >= -1) {
                    routesMap.get(key).times.push(minutes);
                }
            }
        });
    });
    
    // תצוגת קווים (preview)
    const uniqueRoutes = Array.from(routesMap.values())
        .filter(r => r.times.length > 0)
        .slice(0, 5);
    
    if (uniqueRoutes.length === 0) {
        routesPreview.innerHTML = '<div style="font-size: 11px; color: #999;">אין נתוני זמן אמת</div>';
        arrivalsContainer.innerHTML = '<div style="font-size: 13px; color: #999; text-align: center; padding: 10px;">אין זמני הגעה זמינים</div>';
        return;
    }
    
    routesPreview.innerHTML = uniqueRoutes
        .map(r => `<span class="route-badge-small">${r.routeNumber}</span>`)
        .join('');
    
    // תצוגת זמני הגעה מפורטת
    arrivalsContainer.innerHTML = '';
    
    uniqueRoutes.forEach(route => {
        route.times.sort((a, b) => a - b);
        const topTimes = route.times.slice(0, 3);
        
        const arrivalItem = document.createElement('div');
        arrivalItem.className = 'arrival-item';
        
        const timesHtml = topTimes.map(m => {
            let cls = 'late';
            let txt = m + ' דק׳';
            
            if (m <= 0) {
                txt = 'כעת';
                cls = 'soon';
            } else if (m <= 5) {
                cls = 'soon';
            } else if (m <= 10) {
                cls = 'mid';
            } else if (m <= 20) {
                cls = 'far';
            }
            
            return `<span class="arrival-time ${cls}">${txt}</span>`;
        }).join('');
        
        arrivalItem.innerHTML = `
            <div class="arrival-route">
                <div class="arrival-route-number">${route.routeNumber}</div>
                <div class="arrival-headsign">${route.headsign}</div>
            </div>
            <div class="arrival-times">${timesHtml}</div>
        `;
        
        arrivalsContainer.appendChild(arrivalItem);
    });
}

// ==========================================
// אתחול במצב Local
// ==========================================

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
                
                // טעינת תחנות קרובות
                await loadNearbyStops(userLat, userLon);
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

// ==========================================
// לולאת רענון זמן אמת (ל-Local)
// ==========================================

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

                    const filtered = relevantVehicles.length ? relevantVehicles : vehiclesRaw;

                    const slimVehicles = filtered.map(v => {
                        const trip = v.trip || {};
                        const onwardCalls = trip.onwardCalls || {};
                        const calls = Array.isArray(onwardCalls.calls) ? onwardCalls.calls : [];
                        const gtfs = trip.gtfsInfo || {};
                        const pos = v.geo?.positionOnLine?.positionOnLine ?? null;
                        const loc = v.geo?.location || {};
                        
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
                            routeDate: r.routeDate,
                            routeNumber: r.routeMeta?.routeNumber ?? "",
                            headsign: r.headsign,
                            lastSnapshot: realtimeData.lastSnapshot,
                            operatorColor: r.operatorColor
                        },
                        vehicles: slimVehicles
                    });

                } catch (e) {
                    console.error("RT Error: " + e);
                }
            }

            window.updateRealtimeData(allPayloads);
            
            // רענון תחנות קרובות
            if (nearbyStopsData.length > 0) {
                await loadRealtimeForNearbyStops(nearbyStopsData);
            }

        } catch (e) {
            console.error("Update error:", e);
        }
    }

    // רענון ראשוני
    await update();
    
    // לולאת רענון
    setInterval(update, 10000);
}

// ==========================================
// פונקציות נתונים סטטיים
// ==========================================

window.initStaticData = function(payloads) {
    if (!Array.isArray(payloads)) return;
    
    const container = document.getElementById("routesContainer");
    container.innerHTML = "";
    
    const allCoords = [];
    
    payloads.forEach(p => {
        const meta = p.meta || {};
        const stops = p.stops || [];
        const shape = p.shapeCoords || [];
        
        staticDataStore.set(meta.routeId, { 
            meta, 
            stops, 
            shapeLatLngs: shape.map(c => [c[0], c[1]]) 
        });
        
        const color = meta.operatorColor || "#1976d2";
        createRouteCard(meta.routeId, meta, stops, color);
        
        if (shape.length) {
            shape.forEach(c => allCoords.push([c[0], c[1]]));
            const polyline = L.polyline(shape.map(c => [c[0], c[1]]), {
                color: color,
                weight: 4,
                opacity: 0.7
            }).addTo(mapInstance);
        }
        
        stops.forEach(st => {
            if (st.lat && st.lon) allCoords.push([st.lat, st.lon]);
        });
    });
    
    if (allCoords.length && !mapDidInitialFit) {
        mapInstance.fitBounds(allCoords, { padding: [50, 50] });
        mapDidInitialFit = true;
    }
};

window.updateRealtimeData = function(payloads) {
    if (!Array.isArray(payloads)) return;
    
    busLayerGroup.clearLayers();
    
    payloads.forEach(p => {
        const routeId = p.routeId || p.meta?.routeId;
        const staticInfo = staticDataStore.get(routeId);
        if (!staticInfo) return;
        
        const color = p.meta?.operatorColor || "#1976d2";
        updateCardData(routeId, p, staticInfo.stops, color);
        drawBusesOnMap(p, staticInfo.shapeLatLngs, color);
    });
};

function drawBusesOnMap(updateData, shapeLatLngs, color) {
    const vehicles = updateData.vehicles || [];
    
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

window.setUserLocation = function(lat, lon) {
    if (!mapInstance) return;
    if (userLocationMarker) userLocationMarker.remove();
    userLocationMarker = L.circleMarker([lat, lon], { 
        radius: 8, 
        color: "#1976d2", 
        fillColor: "#2196f3", 
        fillOpacity: 0.6 
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