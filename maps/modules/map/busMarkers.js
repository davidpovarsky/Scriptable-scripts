// modules/map/busMarkers.js
// אחראי על ציור אייקוני אוטובוסים על המפה

export class BusMarkers {
  constructor(busLayerGroup) {
    this.busLayerGroup = busLayerGroup;
  }

  drawBuses(vehicles, color, shapeCoords) {
    if (!this.busLayerGroup) return;

    const shapeLatLngs = shapeCoords ? shapeCoords.map(c => [c[1], c[0]]) : [];
    
    vehicles.forEach(v => {
      let lat = v.lat;
      let lon = v.lon;
      
      // אם אין מיקום מדויק, נשתמש ב-positionOnLine
      if ((!lat || !lon) && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
        const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
        const point = shapeLatLngs[idx];
        if (point) {
          lat = point[0];
          lon = point[1];
        }
      }
      
      if (lat && lon) {
        const bearing = v.bearing || 0;
        const iconHtml = this._createBusIconHtml(bearing, color, v.routeNumber);
        
        L.marker([lat, lon], {
          icon: L.divIcon({
            html: iconHtml,
            className: "",
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          }),
          zIndexOffset: 1000
        }).addTo(this.busLayerGroup);
      }
    });
  }

  _createBusIconHtml(bearing, color, routeNumber) {
    return `
      <div class="bus-marker-container">
        <div class="bus-direction-arrow" style="transform: rotate(${bearing}deg);">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="${color}" stroke="white" stroke-width="2">
            <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
          </svg>
        </div>
        <div class="main-bus-icon" style="background:${color};">
          <span class="material-symbols-outlined">directions_bus</span>
        </div>
        ${routeNumber ? `<div class="route-badge" style="color:${color}; border-color:${color};">${routeNumber}</div>` : ''}
      </div>
    `;
  }
}