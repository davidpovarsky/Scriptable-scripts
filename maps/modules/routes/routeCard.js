// modules/routes/routeCard.js
// אחראי על יצירת ועדכון כרטיסי מסלולים - ללא export

class RouteCard {
  constructor(routeId, meta, stops, color) {
    this.routeId = routeId;
    this.meta = meta;
    this.stops = stops;
    this.color = color;
    this.cardElement = null;
    this.lastUpdateSpan = null;
    this.stopsList = null;
    this.rowsContainer = null;
  }

  create() {
    const container = document.getElementById("routesContainer");
    if (!container) return;

    const card = document.createElement("div");
    card.className = "route-card";

    const header = this._createHeader();
    const stopsList = this._createStopsList();
    
    card.append(header, stopsList);
    container.appendChild(card);
    
    this.cardElement = card;
    this.lastUpdateSpan = header.querySelector(".last-update-text");
    this.stopsList = stopsList;
    this.rowsContainer = stopsList.querySelector(".stops-rows");

    return card;
  }

  _createHeader() {
    const header = document.createElement("header");
    header.style.background = this.color;
    header.innerHTML = `
      <div class="line-main">
        <div>
          <span class="route-number">${this.meta.routeNumber || this.meta.routeCode}</span>
          <span class="headsign">${this.meta.headsign}</span>
        </div>
        <div style="font-size:12px; opacity:0.9">קו ${this.meta.routeCode}</div>
      </div>
      <div class="sub">
        <span>${this.meta.routeDate || ""}</span>
        <span class="last-update-text">ממתין לעדכון...</span>
      </div>
    `;
    return header;
  }

  _createStopsList() {
    const stopsList = document.createElement("div");
    stopsList.className = "stops-list";
    
    const rowsContainer = document.createElement("div");
    rowsContainer.className = "stops-rows";
    
    this.stops.forEach((stop, idx) => {
      const row = this._createStopRow(stop, idx);
      rowsContainer.appendChild(row);
    });
    
    stopsList.appendChild(rowsContainer);
    return stopsList;
  }

  _createStopRow(stop, idx) {
    const row = document.createElement("div");
    row.className = "stop-row";
    
    const isFirst = idx === 0;
    const isLast = idx === this.stops.length - 1;
    
    const timeline = document.createElement("div");
    timeline.className = `timeline${isFirst ? ' first' : ''}${isLast ? ' last' : ''}`;
    timeline.innerHTML = `
      <div class="timeline-line line-top"></div>
      <div class="timeline-circle" style="border-color:${this.color}"></div>
      <div class="timeline-line line-bottom"></div>
    `;
    
    const main = document.createElement("div");
    main.className = "stop-main";
    main.innerHTML = `
      <div class="stop-name">
        <span class="seq-num" style="color:${this.color}">${idx + 1}.</span>
        <span>${stop.stopName}</span>
      </div>
      <div class="stop-code">${stop.stopCode || ""}</div>
      <div class="stop-buses" id="buses-${this.routeId}-${stop.stopCode}"></div>
    `;
    
    row.append(timeline, main);
    return row;
  }

  update(updateData) {
    if (!this.lastUpdateSpan || !this.stopsList) return;

    const meta = updateData.meta || {};
    const snap = meta.lastSnapshot || meta.lastVehicleReport || new Date().toISOString();
    const timeStr = snap.split("T")[1]?.split(".")[0] || snap;
    this.lastUpdateSpan.textContent = "עדכון: " + timeStr;

    this._updateStopTimes(updateData);
    this._updateTimelineIcons(updateData);
  }

  _updateStopTimes(updateData) {
    const busesByStop = new Map();
    const now = new Date();
    
    (updateData.vehicles || []).forEach(v => {
      if (!v.onwardCalls) return;
      
      v.onwardCalls.forEach(c => {
        if (!c.stopCode || !c.eta) return;
        
        const minutes = Math.round((new Date(c.eta) - now) / 60000);
        if (minutes < -1) return;
        
        const sc = String(c.stopCode);
        if (!busesByStop.has(sc)) {
          busesByStop.set(sc, []);
        }
        busesByStop.get(sc).push(minutes);
      });
    });

    this.stops.forEach(stop => {
      const container = document.getElementById(`buses-${this.routeId}-${stop.stopCode}`);
      if (!container) return;
      
      const times = busesByStop.get(String(stop.stopCode));
      if (times && times.length) {
        times.sort((a, b) => a - b);
        container.innerHTML = times.slice(0, 3).map(m => {
          let cls = "bus-late";
          let txt = m + " דק׳";
          
          if (m <= 0) {
            txt = "כעת";
            cls = "bus-soon";
          } else if (m <= 5) {
            cls = "bus-soon";
          } else if (m <= 10) {
            cls = "bus-mid";
          } else if (m <= 20) {
            cls = "bus-far";
          }
          
          return `<div class="bus-chip ${cls}">${txt}</div>`;
        }).join("");
      } else {
        container.innerHTML = "";
      }
    });
  }

  _updateTimelineIcons(updateData) {
    this.stopsList.querySelectorAll(".bus-icon-timeline").forEach(e => e.remove());
    
    const listHeight = this.rowsContainer.offsetHeight;
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
      icon.style.color = this.color;
      icon.style.top = top + "px";
      
      this.stopsList.appendChild(icon);
    });
  }

  getElement() {
    return this.cardElement;
  }
}