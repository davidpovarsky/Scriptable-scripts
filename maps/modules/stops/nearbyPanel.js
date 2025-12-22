// modules/stops/nearbyPanel.js
// אחראי על פאנל התחנות הקרובות ועדכון הזמנים - ללא export

class NearbyPanel {
  constructor() {
    this.stopsData = [];
  }

  init(stops) {
    if (!Array.isArray(stops)) return;
    this.stopsData = stops;

    // מפת stopId -> stopCode בשביל fallback כשמגיע onwardCalls עם stopId בלבד
    this.stopIdToCode = new Map();
    stops.forEach(s => {
      if (!s) return;
      const id = s.stopId != null ? String(s.stopId) : "";
      const code = s.stopCode != null ? String(s.stopCode) : "";
      if (id && code) this.stopIdToCode.set(id, code);
    });

    this.render();
  }

  render() {
    const container = document.getElementById("nearbyStopsList");
    if (!container) return;

    if (!this.stopsData.length) {
      container.innerHTML = '<div style="padding:12px; color:#777;">לא נמצאו תחנות קרובות</div>';
      return;
    }

    container.innerHTML = this.stopsData.map((stop, idx) => {
      const code = String(stop.stopCode || "");
      const name = stop.stopName || "";
      const isActive = idx === 0;

      return `
        <div class="stop-bubble ${isActive ? "active" : ""}" data-stopcode="${code}">
          <div class="sb-head" onclick="window.nearbyPanelToggle('${code}')">
            <div class="sb-title">${name}</div>
            <div class="sb-code">${code}</div>
          </div>
          <div class="sb-times" id="times-${code}">
            <div style="padding:10px; text-align:center; color:#999; font-size:12px;">ממתין לנתונים...</div>
          </div>
        </div>
      `;
    }).join("");

    // ברירת מחדל: הראשון פתוח
    setTimeout(() => {
      const first = container.querySelector(".stop-bubble");
      if (first) first.classList.add("active");
    }, 0);
  }

  toggle(stopCode) {
    const el = document.querySelector(`.stop-bubble[data-stopcode="${stopCode}"]`);
    if (!el) return;

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
    if (!Array.isArray(updates)) return;

    const now = new Date();
    const arrivalsByStop = new Map(); // stopCode -> arrivals[]

    let callsProcessed = 0;
    let callsMatched = 0;

    // איסוף כל הזמנים לפי תחנה
    updates.forEach(u => {
      if (!u || !Array.isArray(u.vehicles)) return;

      u.vehicles.forEach(v => {
        if (!v || !Array.isArray(v.onwardCalls)) return;

        v.onwardCalls.forEach(call => {
          if (!call || !call.eta) return;
          callsProcessed++;

          // נזהה stopCode גם אם הגיע רק stopId
          let sc = call.stopCode != null ? String(call.stopCode) : "";
          if (!sc && call.stopId != null && this.stopIdToCode) {
            const mapped = this.stopIdToCode.get(String(call.stopId));
            if (mapped) sc = String(mapped);
          }
          if (!sc) return;

          const etaDate = new Date(call.eta);
          const minutes = Math.round((etaDate - now) / 60000);

          // לא מציגים "כעת" על מינוס (מינוס = עבר)
          if (minutes < 0) return;

          callsMatched++;

          if (!arrivalsByStop.has(sc)) arrivalsByStop.set(sc, []);
          arrivalsByStop.get(sc).push({
            line: v.routeNumber || "?",
            dest: v.headsign || "",
            min: minutes,
            eta: call.eta
          });
        });
      });
    });

    console.log(`🚌 NearbyPanel: calls=${callsProcessed}, matchedStops=${arrivalsByStop.size}, matchedCalls=${callsMatched}`);

    // עדכון התצוגה לכל התחנות שאנחנו מציגים (גם אם אין הגעות)
    this.stopsData.forEach(stop => {
      const stopCode = stop && stop.stopCode != null ? String(stop.stopCode) : "";
      if (!stopCode) return;

      const container = document.getElementById(`times-${stopCode}`);
      if (!container) return;

      const arrivals = arrivalsByStop.get(stopCode) || [];
      arrivals.sort((a, b) => a.min - b.min);

      const html = arrivals.slice(0, 5).map(arr => {
        const timeText = arr.min === 0 ? "כעת" : `${arr.min} דק'`;
        return `
          <div class="sb-row">
            <div class="sb-route-badge">${arr.line}</div>
            <div class="sb-dest">${arr.dest}</div>
            <div class="sb-eta">${timeText}</div>
          </div>
        `;
      }).join("");

      container.innerHTML = html || '<div style="padding:10px; text-align:center; color:#999; font-size:12px;">אין הגעות בזמן הקרוב</div>';
    });
  }

  getStopsData() {
    return this.stopsData;
  }
}

// יצירת אינסטנס גלובלי
window.nearbyPanel = new NearbyPanel();

// פונקציה גלובלית לטוגל
window.nearbyPanelToggle = (stopCode) => {
  if (window.nearbyPanel) window.nearbyPanel.toggle(stopCode);
};

// פונקציה גלובלית לאתחול תחנות
window.initNearbyStops = (stops) => {
  console.log("📍 Initializing nearby stops:", Array.isArray(stops) ? stops.length : 0);
  if (window.nearbyPanel) window.nearbyPanel.init(stops);
};

// פונקציה גלובלית לעדכון זמן אמת
window.updateNearbyStopsRealtime = (updates) => {
  if (window.nearbyPanel) window.nearbyPanel.updateTimes(updates);
};
