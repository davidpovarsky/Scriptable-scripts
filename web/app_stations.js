// app_stations.js - לוגיקת התחנות הקרובות בפאנל הצדדי

// State לתחנות
let nearestStopsData = [];
let currentStationData = {};

// פונקציה שתיקרא מ-integration.js
window.setNearestStops = function(stops) {
  nearestStopsData = stops || [];
  console.log('Nearest stops received:', nearestStopsData);
  
  if (nearestStopsData.length > 0) {
    // הצג את התחנה הראשונה
    displayStation(nearestStopsData[0]);
  }
};

// הצגת נתוני תחנה
async function displayStation(stop) {
  const loaderMsg = document.getElementById('loader-msg-stations');
  const stopContainer = document.querySelector('.stop-container-stations');
  const stopTitle = document.getElementById('stop-title-stations');
  
  if (loaderMsg) loaderMsg.style.display = 'flex';
  if (stopContainer) stopContainer.style.display = 'none';
  
  try {
    // קריאה ל-API לקבלת נתוני התחנה
    const data = await fetchStationData(stop.stopCode);
    
    if (data && data.groups && data.groups.length > 0) {
      currentStationData[stop.stopCode] = data;
      
      if (stopTitle) {
        stopTitle.textContent = data.name || stop.stopName || 'תחנה';
      }
      
      renderStationCards(data.groups, stop.stopCode);
      
      if (loaderMsg) loaderMsg.style.display = 'none';
      if (stopContainer) stopContainer.style.display = 'block';
    } else {
      // אין נתונים
      if (loaderMsg) loaderMsg.style.display = 'none';
      if (stopContainer) stopContainer.style.display = 'block';
      document.getElementById('empty-msg-stations').style.display = 'block';
    }
  } catch (e) {
    console.error('Error displaying station:', e);
    if (loaderMsg) {
      loaderMsg.innerHTML = '<div style="color: #e53e3e;">שגיאה בטעינת נתונים</div>';
    }
  }
}

// קריאה לנתוני תחנה (דומה ל-KavNavAPI.getStopData)
async function fetchStationData(stopCode) {
  try {
    const API_BASE = "https://kavnav.com/api";
    const PROXY_URL = "https://script.google.com/macros/s/AKfycbxKfWtTeeoOJCoR_WD4JQhvDGHcE3j82tVHVQXqElwL9NVO9ourZxSHTA20GoBJKfmiLw/exec";
    const IS_LOCAL = window.APP_ENVIRONMENT === 'local';
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // קריאות מקבילות
    const [realtimeData, summaryData] = await Promise.all([
      fetchJSON(`${API_BASE}/realtime?stopCode=${stopCode}`, IS_LOCAL, PROXY_URL),
      fetchJSON(`${API_BASE}/stopSummary?stopCode=${stopCode}`, IS_LOCAL, PROXY_URL)
    ]);
    
    // בניית routeMap
    const routeMap = {};
    if (summaryData) {
      const summaries = Array.isArray(summaryData) ? summaryData : [summaryData];
      summaries.forEach(g => {
        if (g && g.routes) {
          g.routes.forEach(r => {
            if (r && r.routeId && r.routeNumber) {
              routeMap[r.routeId] = r.routeNumber;
            }
          });
        }
      });
    }
    
    // בניית trips
    const trips = [];
    
    if (realtimeData && realtimeData.vehicles) {
      realtimeData.vehicles.forEach(bus => {
        const call = bus.trip?.onwardCalls?.calls?.find(c => String(c.stopCode) === String(stopCode));
        if (!call) return;
        
        const eta = new Date(call.eta);
        const minutes = Math.round((eta - new Date()) / 60000);
        
        if (minutes < 0 || minutes > 60) return;
        
        trips.push({
          line: bus.trip.gtfsInfo?.routeNumber || routeMap[bus.trip.routeId] || "?",
          headsign: bus.trip.gtfsInfo?.headsign || "",
          minutes,
          realtime: true
        });
      });
    }
    
    // קיבוץ לפי קו ויעד
    const grouped = {};
    trips.forEach(t => {
      const k = t.line + "_" + t.headsign;
      if (!grouped[k]) {
        grouped[k] = { line: t.line, headsign: t.headsign, arrivals: [] };
      }
      grouped[k].arrivals.push(t);
    });
    
    // מיון הגעות
    Object.values(grouped).forEach(g => {
      g.arrivals.sort((a, b) => a.minutes - b.minutes);
      g.arrivals = g.arrivals.slice(0, 4);
    });
    
    return {
      stopCode,
      name: summaryData?.[0]?.name || summaryData?.name || null,
      groups: Object.values(grouped)
    };
    
  } catch (e) {
    console.error('Error fetching station data:', e);
    return null;
  }
}

// פונקציית עזר לקריאת JSON
async function fetchJSON(url, isLocal, proxyUrl) {
  try {
    const finalUrl = isLocal ? proxyUrl + "?url=" + encodeURIComponent(url) : url;
    const response = await fetch(finalUrl);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error('Fetch error:', e);
    return null;
  }
}

// רינדור כרטיסי קווים
function renderStationCards(groups, stopCode) {
  const container = document.getElementById('cards-container-stations');
  const emptyMsg = document.getElementById('empty-msg-stations');
  
  if (!container) return;
  
  if (!groups || groups.length === 0) {
    container.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = 'block';
    return;
  }
  
  if (emptyMsg) emptyMsg.style.display = 'none';
  container.innerHTML = '';
  
  groups.forEach(g => {
    const card = createStationLineCard(g);
    container.appendChild(card);
  });
}

// יצירת כרטיס קו
function createStationLineCard(group) {
  const card = document.createElement('div');
  card.className = 'line-card-stations';
  
  const arrivals = group.arrivals || [];
  
  card.innerHTML = `
    <div class="line-header-stations">
      <div class="route-num-stations">${group.line}</div>
      <div class="headsign-stations">${group.headsign || ''}</div>
    </div>
    <div class="times-row-stations">
      ${arrivals.map(a => createTimeChip(a)).join('')}
    </div>
  `;
  
  return card;
}

// יצירת chip זמן
function createTimeChip(arrival) {
  const minutes = arrival.minutes;
  const isRealtime = arrival.realtime;
  const isStale = arrival.stale;
  
  let timeText = '';
  if (minutes <= 0) timeText = 'כעת';
  else if (minutes < 60) timeText = minutes + ' דק׳';
  else {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    timeText = d.toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'});
  }
  
  let classes = 'time-chip-stations';
  if (isRealtime && !isStale) classes += ' realtime';
  if (isRealtime && isStale) classes += ' stale';
  
  const dotHtml = isRealtime ? '<div class="pulse-dot-stations"></div>' : '';
  
  return `
    <div class="${classes}">
      ${dotHtml}
      <span>${timeText}</span>
    </div>
  `;
}

// רענון תחנות (יקרא מ-integration)
window.refreshNearestStations = async function() {
  if (nearestStopsData.length === 0) return;
  
  // רענן את התחנה הראשונה
  await displayStation(nearestStopsData[0]);
};

console.log('app_stations.js loaded');