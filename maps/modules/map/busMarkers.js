// modules/map/busMarkers.js
// אחראי על ציור אוטובוסים תלת-מימדיים על המפה - גרסה משולבת
// תמיכה ב-CSS 3D + GLB Model

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map();
    this.use3DModel = true; // Toggle between CSS 3D and GLB model
    this.model3DManager = null;
    
    console.log("🚌 BusMarkers initialized");
  }

  async init3DModels() {
    if (!window.Bus3DModelManager) {
      console.warn("⚠️ Bus3DModelManager not available, using CSS 3D fallback");
      this.use3DModel = false;
      return;
    }

    try {
      this.model3DManager = new Bus3DModelManager(this.mapManager);
      const success = await this.model3DManager.init();
      
      if (success) {
        console.log("✅ 3D GLB models enabled");
        this.use3DModel = true;
      } else {
        console.warn("⚠️ 3D model initialization failed, using CSS fallback");
        this.use3DModel = false;
      }
    } catch (e) {
      console.error("❌ Error initializing 3D models:", e);
      this.use3DModel = false;
    }
  }

  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map) {
      return; // Map not ready
    }

    if (!Array.isArray(vehicles)) {
      return;
    }

    const shapeLatLngs = shapeCoords ? shapeCoords.map(c => [c[0], c[1]]) : [];
    
    vehicles.forEach(v => {
      try {
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
          const vehicleId = v.vehicleId || `${v.routeNumber}-${v.tripId || Math.random()}`;
          const bearing = v.bearing || this.calculateBearing(v, shapeLatLngs);
          
          if (this.use3DModel && this.model3DManager && this.model3DManager.isModelLoaded()) {
            // Use GLB 3D model
            this.model3DManager.addOrUpdateBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
          } else {
            // Fallback to CSS 3D
            this.drawCSS3DBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
          }
        }
      } catch (e) {
        console.error("❌ Error drawing bus:", e);
      }
    });
  }

  calculateBearing(vehicle, shapeLatLngs) {
    // Try to calculate bearing from position on line
    if (typeof vehicle.positionOnLine === "number" && shapeLatLngs.length > 1) {
      const idx = Math.floor(vehicle.positionOnLine * (shapeLatLngs.length - 1));
      
      if (idx < shapeLatLngs.length - 1) {
        const p1 = shapeLatLngs[idx];
        const p2 = shapeLatLngs[idx + 1];
        return this.mapManager.getBearing(p1, p2);
      }
    }
    
    return vehicle.bearing || 0;
  }

  drawCSS3DBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    try {
      let marker = this.busMarkers.get(vehicleId);
      
      if (marker) {
        // Update existing CSS marker
        this.animateBusTo(vehicleId, lon, lat, 2000);
        
        // Update rotation
        const el = marker.getElement();
        if (el) {
          const model = el.querySelector('.bus-3d-container');
          if (model) {
            model.style.transform = `rotateZ(${bearing}deg)`;
          }
        }
      } else {
        // Create new CSS 3D marker
        const el = this._createCSS3DBusElement(bearing, color, routeNumber);
        
        marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
          rotationAlignment: 'map',
          pitchAlignment: 'map'
        })
          .setLngLat([lon, lat])
          .addTo(this.map);
        
        this.busMarkers.set(vehicleId, marker);
      }
    } catch (e) {
      console.error(`❌ Error drawing CSS 3D bus ${vehicleId}:`, e);
    }
  }

  _createCSS3DBusElement(bearing, color, routeNumber) {
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

  pruneMarkers(activeVehicleIds) {
    if (!activeVehicleIds || !(activeVehicleIds instanceof Set)) return;

    if (this.use3DModel && this.model3DManager) {
      // Prune 3D models
      this.model3DManager.pruneMarkers(activeVehicleIds);
    } else {
      // Prune CSS markers
      this.busMarkers.forEach((marker, id) => {
        if (!activeVehicleIds.has(id)) {
          try {
            if (marker.remove) marker.remove();
            this.busMarkers.delete(id);
          } catch (e) {
            console.error("❌ Error removing marker:", e);
          }
        }
      });
    }
  }

  clearAll() {
    // Clear CSS markers
    this.busMarkers.forEach(marker => {
      try {
        if (marker && marker.remove) {
          marker.remove();
        }
      } catch (e) {
        console.error("❌ Error clearing marker:", e);
      }
    });
    this.busMarkers.clear();

    // Clear 3D models
    if (this.model3DManager) {
      this.model3DManager.clearAll();
    }
    
    console.log("🗑️ All buses cleared");
  }

  animateBusTo(vehicleId, newLon, newLat, duration = 2000) {
    const marker = this.busMarkers.get(vehicleId);
    if (!marker) return;

    try {
      const start = marker.getLngLat();
      const end = [newLon, newLat];
      
      // אם המרחק קטן מאוד, לא צריך אנימציה
      if (Math.abs(start.lng - end[0]) < 0.00001 && Math.abs(start.lat - end[1]) < 0.00001) {
        return;
      }
      
      let startTime = null;
      
      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        // Easing function (Ease Out Quad)
        const eased = progress * (2 - progress);
        
        const currentLng = start.lng + (end[0] - start.lng) * eased;
        const currentLat = start.lat + (end[1] - start.lat) * eased;
        
        marker.setLngLat([currentLng, currentLat]);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    } catch (e) {
      console.error("❌ Error animating bus:", e);
    }
  }

  toggle3DModelMode(enable) {
    this.use3DModel = enable && this.model3DManager && this.model3DManager.isModelLoaded();
    console.log(`🎨 3D Model mode: ${this.use3DModel ? 'GLB' : 'CSS'}`);
    
    // Clear and redraw all buses
    this.clearAll();
  }

  get3DModelManager() {
    return this.model3DManager;
  }

  isUsingGLBModel() {
    return this.use3DModel && this.model3DManager && this.model3DManager.isModelLoaded();
  }
}
