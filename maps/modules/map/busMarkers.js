// modules/map/busMarkers.js
// אחראי על ציור אוטובוסים תלת-מימדיים על המפה - Mapbox version
// גרסה מתוקנת: אנימציה חלקה + מניעת הבהובים

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map();
    this.modelLoaded = true;
    
    console.log("🚌 BusMarkers initialized (Mapbox Fixed)");
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
          const bearing = v.bearing || 0;
          
          this.draw3DBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
        }
      } catch (e) {
        console.error("❌ Error drawing bus:", e);
      }
    });

    // הערה: הסרנו מכאן את לוגיקת המחיקה. המחיקה מתבצעת כעת ב-pruneMarkers
  }

  // פונקציה חדשה לניקוי רכבים שלא קיימים יותר
  pruneMarkers(activeVehicleIds) {
    if (!activeVehicleIds || !(activeVehicleIds instanceof Set)) return;

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

  draw3DBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    try {
      let marker = this.busMarkers.get(vehicleId);
      
      if (marker) {
        // === שינוי: שימוש באנימציה במקום קפיצה ===
        this.animateBusTo(vehicleId, lon, lat, 2000); // 2 שניות אנימציה
        
        // עדכון רוטציה
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
        
        marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
          rotationAlignment: 'map',
pitchAlignment: 'viewport'
        })
          .setLngLat([lon, lat])
          .addTo(this.map);
        
        this.busMarkers.set(vehicleId, marker);
      }
    } catch (e) {
      console.error(`❌ Error drawing 3D bus ${vehicleId}:`, e);
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

  clearAll() {
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
    console.log("🗑️ All buses cleared");
  }

  animateBusTo(vehicleId, newLon, newLat, duration = 2000) {
    const marker = this.busMarkers.get(vehicleId);
    if (!marker) return;

    try {
      const start = marker.getLngLat();
      const end = [newLon, newLat];
      
      // אם המרחק קטן מאוד, לא צריך אנימציה (מונע רעידות בעמידה)
      if (Math.abs(start.lng - end[0]) < 0.00001 && Math.abs(start.lat - end[1]) < 0.00001) {
        return;
      }
      
      let startTime = null;
      
      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        // Easing function (Ease Out Quad) - מתחיל מהר ומאיט בסוף
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
}
