// modules/map/busMarkers.js
class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map();
    this.modelLoaded = true;
    
    console.log("🚌 BusMarkers initialized (Mapbox)");
  }

  // עדכון: מקבלים את רשימת הרכבים ומציירים/מעדכנים אותם. לא מוחקים כאן כלום!
  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map) return;
    if (!Array.isArray(vehicles)) return;

    const shapeLatLngs = shapeCoords ? shapeCoords.map(c => [c[0], c[1]]) : [];
    
    vehicles.forEach(v => {
      try {
        let lon = v.lon;
        let lat = v.lat;
        
        // השלמת מיקום אם חסר
        if ((!lat || !lon) && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
          const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
          const point = shapeLatLngs[idx];
          if (point) {
            lon = point[0];
            lat = point[1];
          }
        }
        
        if (lat && lon) {
          // יצירת ID ייחודי
          const vehicleId = v.vehicleId || `${v.routeNumber}-${v.tripId || 'N/A'}`;
          const bearing = v.bearing || 0;
          
          this.draw3DBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
        }
      } catch (e) {
        console.error("❌ Error drawing bus:", e);
      }
    });
  }

  // פונקציה חדשה: מוחקת רכבים שלא נמצאים ברשימה הפעילה
  pruneMarkers(activeVehicleIds) {
    if (!activeVehicleIds || !(activeVehicleIds instanceof Set)) return;

    this.busMarkers.forEach((marker, id) => {
      if (!activeVehicleIds.has(id)) {
        try {
          marker.remove(); // הסרה מהמפה
          this.busMarkers.delete(id); // הסרה מהזיכרון
        } catch (e) {
          console.error("❌ Error removing marker:", e);
        }
      }
    });
  }

  draw3DBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    let marker = this.busMarkers.get(vehicleId);
    
    if (marker) {
      // === תיקון 2: שימוש באנימציה לרכבים קיימים ===
      this.animateBusTo(vehicleId, lon, lat, 2000); // 2 שניות אנימציה להחלקה
      
      // עדכון רוטציה (ללא אנימציה בינתיים, כדי לא להעמיס)
      const el = marker.getElement();
      if (el) {
        const model = el.querySelector('.bus-3d-container');
        if (model) {
          model.style.transform = `rotateZ(${bearing}deg)`;
        }
      }
    } else {
      // יצירה ראשונית
      const el = this._create3DBusElement(bearing, color, routeNumber);
      
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
  }

  _create3DBusElement(bearing, color, routeNumber) {
    const el = document.createElement('div');
    el.className = 'bus-marker-3d';
    // ה-HTML נשאר זהה למה ששלחת
    el.innerHTML = `
      <div class="bus-3d-container" style="transform: rotateZ(${bearing}deg);">
        <div class="bus-3d-model" style="background: ${color};">
          <div class="bus-3d-body">
            <div class="bus-3d-front"></div>
          </div>
          <div class="bus-3d-wheels">
            <div class="wheel wheel-fl"></div>
            <div class="wheel wheel-fr"></div>
            <div class="wheel wheel-rl"></div>
            <div class="wheel wheel-rr"></div>
          </div>
        </div>
        ${routeNumber ? `<div class="route-badge-3d" style="border-color: ${color}; color: ${color};">${routeNumber}</div>` : ''}
      </div>
      <div class="bus-3d-shadow"></div>
    `;
    return el;
  }

  animateBusTo(vehicleId, newLon, newLat, duration = 2000) {
    const marker = this.busMarkers.get(vehicleId);
    if (!marker) return;

    const start = marker.getLngLat();
    const end = [newLon, newLat];
    
    // אם המרחק קצר מאוד, נקפוץ ישר (מונע רעידות)
    if (Math.abs(start.lng - end[0]) < 0.00001 && Math.abs(start.lat - end[1]) < 0.00001) {
       return;
    }

    let startTime = null;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function (Ease-Out Quad)
      const t = progress * (2 - progress);
      
      const currentLng = start.lng + (end[0] - start.lng) * t;
      const currentLat = start.lat + (end[1] - start.lat) * t;
      
      marker.setLngLat([currentLng, currentLat]);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }
}
