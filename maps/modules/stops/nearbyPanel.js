// modules/stops/nearbyPanel.js
// אחראי על פאנל התחנות הקרובות ועדכון הזמנים - ללא export

class NearbyPanel {
  constructor() {
    this.stopsData = [];
  }

  init(stops) {
    if (!Array.isArray(stops)) return;
    this.stopsData = stops;
    this.render();
  }

  render() {
    const container = document.getElementById('nearbyStopsList');
    if (!container) return;
    
    container.innerHTML = '';

    if (this.stopsData.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">לא נמצאו תחנות קרובות</div>';
      return;
    }

    this.stopsData.forEach((stop, index) => {
      const bubble = this._createStopBubble(stop, index === 0);
      container.appendChild(bubble);
    });
  }

  _createStopBubble(stop, isActive = false) {
    const div = document.createElement('div');
    div.className = `stop-bubble ${isActive ? 'active' : ''}`;
    div.id = `bubble-${stop.stopCode}`;
    div.onclick = (e) => this._toggleBubble(div, e);

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
    
    return div;
  }

  _toggleBubble(el, event) {
    // רק אחד פתוח בו זמנית
    document.querySelectorAll('.stop-bubble').forEach(b => {
      if (b !== el) b.classList.remove('active');
    });
    
    el.classList.toggle('active');
    
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  }

  updateTimes(updates) {
    const arrivalsByStop = new Map();

    // איסוף כל הזמנים לפי תחנה
    updates.forEach(u => {
      if (!u.vehicles) return;
      
      u.vehicles.forEach(v => {
        if (!v.onwardCalls) return;
        
        v.onwardCalls.forEach(call => {
          const sc = String(call.stopCode);
          const stopContainer = document.getElementById(`times-${sc}`);
          
          if (stopContainer) {
            if (!arrivalsByStop.has(sc)) {
              arrivalsByStop.set(sc, []);
            }
            
            const etaDate = new Date(call.eta);
            const minutes = Math.round((etaDate - new Date()) / 60000);
            
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

    // עדכון התצוגה
    arrivalsByStop.forEach((arrivals, stopCode) => {
      const container = document.getElementById(`times-${stopCode}`);
      if (!container) return;

      arrivals.sort((a, b) => a.min - b.min);
      
      const html = arrivals.slice(0, 5).map(arr => {
        const timeText = arr.min <= 0 ? 'כעת' : `${arr.min} דק'`;
        return `
          <div class="sb-row">
            <div class="sb-route-badge">${arr.line}</div>
            <div class="sb-dest">${arr.dest}</div>
            <div class="sb-eta">${timeText}</div>
          </div>
        `;
      }).join('');

      container.innerHTML = html || '<div style="padding:10px; text-align:center; color:#999; font-size:12px;">אין הגעות בזמן הקרוב</div>';
    });
  }

  getStopsData() {
    return this.stopsData;
  }
}