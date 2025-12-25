// modules/map/busMarkers.js
// אחראי על ציור אוטובוסים תלת-מימדיים על המפה

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map();
    this.modelLoaded = false;
    this.busModel = null;
    
    // Initialize 3D model layer when map is ready
    if (this.map.loaded()) {
      this.init3DLayer();
    } else {
      this.map.on('load', () => this.init3DLayer());
    }
  }

  async init3DLayer() {
    // Load the 3D bus model
    try {
      await this.loadBusModel();
      console.log('🚌 3D bus model ready');
    } catch (e) {
      console.error('Failed to load 3D model:', e);
      // Fallback to 2D markers
      this.modelLoaded = false;
    }
  }

  async loadBusModel() {
    return new Promise((resolve, reject) => {
      const modelUrl = 'https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/deckgl-3d/maps/Bus4glb.glb';
      
      // We'll use the model via custom layer
      this.busModel = modelUrl;
      this.modelLoaded = true;
      resolve();
    });
  }

  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map) return;

    const shapeLatLngs = shapeCoords ? shapeCoords.map(c => [c[0], c[1]]) : []; // lon, lat
    
    vehicles.forEach(v => {
      let lon = v.lon;
      let lat = v.lat;
      
      // אם אין מיקום מדויק, נשתמש ב-positionOnLine
      if ((!lat || !lon) && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
        const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
        const point = shapeLatLngs[idx];
        if (point) {
          lon = point[0];
          lat = point[1];
        }
      }
      
      if (lat && lon) {
        const vehicleId = v.vehicleId || `${v.routeNumber}-${v.tripId}`;
        const bearing = v.bearing || 0;
        
        if (this.modelLoaded) {
          this.draw3DBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
        } else {
          this.draw2DBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
        }
      }
    });

    // Remove buses that no longer exist
    const currentVehicleIds = new Set(
      vehicles
        .filter(v => v.lat && v.lon)
        .map(v => v.vehicleId || `${v.routeNumber}-${v.tripId}`)
    );

    this.busMarkers.forEach((marker, id) => {
      if (!currentVehicleIds.has(id)) {
        if (marker.remove) marker.remove();
        this.busMarkers.delete(id);
      }
    });
  }

  draw3DBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    // Check if marker exists
    let marker = this.busMarkers.get(vehicleId);
    
    if (marker) {
      // Update existing marker
      marker.setLngLat([lon, lat]);
      
      // Update rotation
      const el = marker.getElement();
      if (el) {
        const model = el.querySelector('.bus-3d-container');
        if (model) {
          model.style.transform = `rotateZ(${bearing}deg)`;
        }
      }
    } else {
      // Create new 3D marker
      const el = this._create3DBusElement(bearing, color, routeNumber);
      
      marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
        rotationAlignment: 'map',
        pitchAlignment: 'map'
      })
        .setLngLat([lon, lat])
        .addTo(this.map);
      
      this.busMarkers.set(vehicleId, marker);
    }
  }

  draw2DBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    // Fallback to 2D markers
    let marker = this.busMarkers.get(vehicleId);
    
    if (marker) {
      // Update existing marker
      marker.setLngLat([lon, lat]);
      
      // Update rotation
      const el = marker.getElement();
      if (el) {
        const arrow = el.querySelector('.bus-direction-arrow');
        if (arrow) {
          arrow.style.transform = `rotate(${bearing}deg)`;
        }
      }
    } else {
      // Create new 2D marker
      const el = this._create2DBusElement(bearing, color, routeNumber);
      
      marker = new maplibregl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([lon, lat])
        .addTo(this.map);
      
      this.busMarkers.set(vehicleId, marker);
    }
  }

  _create3DBusElement(bearing, color, routeNumber) {
    const el = document.createElement('div');
    el.className = 'bus-marker-3d';
    
    el.innerHTML = `
      <div class="bus-3d-container" style="transform: rotateZ(${bearing}deg);">
        <div class="bus-3d-model" style="background: ${color};">
          <div class="bus-3d-body">
            <div class="bus-3d-front"></div>
            <div class="bus-3d-top"></div>
            <div class="bus-3d-side-left"></div>
            <div class="bus-3d-side-right"></div>
          </div>
          <div class="bus-3d-wheels">
            <div class="wheel wheel-fl"></div>
            <div class="wheel wheel-fr"></div>
            <div class="wheel wheel-rl"></div>
            <div class="wheel wheel-rr"></div>
          </div>
        </div>
        ${routeNumber ? `
          <div class="route-badge-3d" style="background: white; color: ${color}; border-color: ${color};">
            ${routeNumber}
          </div>
        ` : ''}
      </div>
      <div class="bus-3d-shadow"></div>
    `;
    
    return el;
  }

  _create2DBusElement(bearing, color, routeNumber) {
    const el = document.createElement('div');
    el.className = 'bus-marker-container';
    
    el.innerHTML = `
      <div class="bus-direction-arrow" style="transform: rotate(${bearing}deg);">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="${color}" stroke="white" stroke-width="2">
          <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
        </svg>
      </div>
      <div class="main-bus-icon" style="background:${color};">
        <span class="material-symbols-outlined">directions_bus</span>
      </div>
      ${routeNumber ? `<div class="route-badge" style="color:${color}; border-color:${color};">${routeNumber}</div>` : ''}
    `;
    
    return el;
  }

  clearAll() {
    this.busMarkers.forEach(marker => {
      if (marker && marker.remove) {
        marker.remove();
      }
    });
    this.busMarkers.clear();
  }

  // Animate bus movement (smooth transitions)
  animateBusTo(vehicleId, newLon, newLat, duration = 1000) {
    const marker = this.busMarkers.get(vehicleId);
    if (!marker) return;

    const start = marker.getLngLat();
    const end = [newLon, newLat];
    
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const eased = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;
      
      const currentLng = start.lng + (end[0] - start.lng) * eased;
      const currentLat = start.lat + (end[1] - start.lat) * eased;
      
      marker.setLngLat([currentLng, currentLat]);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }
}
