// modules/map/busMarkers.js
// אחראי על ציור אוטובוסים תלת-מימדיים על המפה

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager ? mapManager.getMap() : null;
    this.busMarkers = new Map();
    this.modelLoaded = false;
    
    if (!this.map) {
      console.error('❌ BusMarkers: Map not available');
      return;
    }
    
    console.log('🚌 BusMarkers initialized');
    
    // Wait for map to load
    if (this.map.loaded()) {
      this.init3DLayer();
    } else {
      this.map.on('load', () => {
        console.log('🚌 Map loaded, initializing 3D layer');
        this.init3DLayer();
      });
    }
  }

  async init3DLayer() {
    try {
      // For now, we'll use CSS 3D models instead of GLB
      this.modelLoaded = true;
      console.log('✅ 3D bus model ready (CSS-based)');
    } catch (e) {
      console.error('Failed to initialize 3D layer:', e);
      this.modelLoaded = false;
    }
  }

  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map) {
      console.warn('Map not available for drawing buses');
      return;
    }

    console.log(`Drawing ${vehicles.length} buses`);

    const shapeLatLngs = shapeCoords ? shapeCoords.map(c => [c[0], c[1]]) : [];
    
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
        const vehicleId = v.vehicleId || `${v.routeNumber}-${v.tripId}` || Math.random();
        const bearing = v.bearing || 0;
        
        try {
          if (this.modelLoaded) {
            this.draw3DBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
          } else {
            this.draw2DBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
          }
        } catch (e) {
          console.error(`Failed to draw bus ${vehicleId}:`, e);
        }
      }
    });

    // Remove buses that no longer exist
    const currentVehicleIds = new Set(
      vehicles
        .filter(v => v.lat && v.lon)
        .map(v => v.vehicleId || `${v.routeNumber}-${v.tripId}` || Math.random())
    );

    this.busMarkers.forEach((marker, id) => {
      if (!currentVehicleIds.has(id)) {
        try {
          if (marker.remove) marker.remove();
        } catch (e) {
          console.error('Failed to remove marker:', e);
        }
        this.busMarkers.delete(id);
      }
    });
    
    console.log(`✅ ${this.busMarkers.size} buses on map`);
  }

  draw3DBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    let marker = this.busMarkers.get(vehicleId);
    
    if (marker) {
      // Update existing marker
      marker.setLngLat([lon, lat]);
      
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
    let marker = this.busMarkers.get(vehicleId);
    
    if (marker) {
      // Update existing marker
      marker.setLngLat([lon, lat]);
      
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
    console.log('Clearing all bus markers');
    this.busMarkers.forEach(marker => {
      if (marker && marker.remove) {
        try {
          marker.remove();
        } catch (e) {
          console.error('Failed to remove marker:', e);
        }
      }
    });
    this.busMarkers.clear();
  }
}