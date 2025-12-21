// modules/map/mapManager.js
// אחראי על אתחול ו��יהול המפה

export class MapManager {
  constructor() {
    this.map = null;
    this.busLayerGroup = null;
    this.userLocationMarker = null;
    this.didInitialFit = false;
  }

  init(elementId = 'map') {
    this.map = L.map(elementId, { zoomControl: false })
      .setView([32.08, 34.78], 13);
    
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    
    L.tileLayer("https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: ""
    }).addTo(this.map);
    
    this.busLayerGroup = L.layerGroup().addTo(this.map);
    this.busLayerGroup.setZIndex(1000);

    return this.map;
  }

  setUserLocation(lat, lon) {
    if (!this.map) return;
    
    if (this.userLocationMarker) {
      this.userLocationMarker.remove();
    }
    
    this.userLocationMarker = L.circleMarker([lat, lon], { 
      radius: 8,
      color: "#1976d2", 
      fillColor: "#2196f3",
      fillOpacity: 0.6 
    }).addTo(this.map);
  }

  centerOnUser() {
    if (this.userLocationMarker && this.map) {
      this.map.setView(this.userLocationMarker.getLatLng(), 16);
    }
  }

  clearBuses() {
    if (this.busLayerGroup) {
      this.busLayerGroup.clearLayers();
    }
  }

  drawRoutePolyline(shapeCoords, color) {
    if (!this.map || !shapeCoords || !shapeCoords.length) return;
    
    const latLngs = shapeCoords.map(c => [c[1], c[0]]);
    
    L.polyline(latLngs, {
      color: color,
      weight: 4,
      opacity: 0.6,
      smoothFactor: 1
    }).addTo(this.map);
  }

  fitBoundsToShapes(allShapeCoords) {
    if (!this.map || !allShapeCoords || !allShapeCoords.length) return;
    if (this.didInitialFit) return;

    const allPoints = [];
    allShapeCoords.forEach(coords => {
      if (Array.isArray(coords)) {
        coords.forEach(c => {
          if (Array.isArray(c) && c.length === 2) {
            allPoints.push([c[1], c[0]]);
          }
        });
      }
    });

    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints);
      this.map.fitBounds(bounds, { padding: [50, 50] });
      this.didInitialFit = true;
    }
  }

  invalidateSize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }

  getMap() {
    return this.map;
  }

  getBusLayerGroup() {
    return this.busLayerGroup;
  }
}