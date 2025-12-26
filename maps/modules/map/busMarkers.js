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

  // Create 3D bus element
  _create3DBusElement(bearing, color, routeNumber) {
    const container = document.createElement('div');
    container.className = 'bus-marker-3d';

    const busContainer = document.createElement('div');
    busContainer.className = 'bus-3d-container';

    const busModel = document.createElement('div');
    busModel.className = 'bus-3d-model';
    busModel.style.backgroundColor = color;

    // Add body
    const body = document.createElement('div');
    body.className = 'bus-3d-body';

    // Front windshield
    const front = document.createElement('div');
    front.className = 'bus-3d-front';

    // Windows
    const windows = document.createElement('div');
    windows.className = 'bus-3d-windows';

    // Wheels
    const wheels = document.createElement('div');
    wheels.className = 'bus-3d-wheels';

    const wheel1 = document.createElement('div');
    wheel1.className = 'wheel';
    const wheel2 = document.createElement('div');
    wheel2.className = 'wheel';

    wheels.appendChild(wheel1);
    wheels.appendChild(wheel2);

    body.appendChild(front);
    body.appendChild(windows);
    body.appendChild(wheels);

    // Direction arrow
    const direction = document.createElement('div');
    direction.className = 'bus-direction';
    direction.innerHTML = '▲';
    direction.style.transform = `rotate(${bearing}deg)`;

    // Route number
    const label = document.createElement('div');
    label.className = 'bus-route-label';
    label.textContent = routeNumber || '';

    // Shadow
    const shadow = document.createElement('div');
    shadow.className = 'bus-3d-shadow';

    busModel.appendChild(body);
    busModel.appendChild(direction);
    if (routeNumber) busModel.appendChild(label);

    busContainer.appendChild(shadow);
    busContainer.appendChild(busModel);

    container.appendChild(busContainer);

    return container;
  }

  // Draw/update all buses
  drawBuses(buses, getRouteColor) {
    if (!this.map || !buses) return;

    const activeIds = new Set();

    for (const bus of buses) {
      const vehicleId = bus.vehicleId || bus.id || bus.vehicle_id;
      if (!vehicleId) continue;
      activeIds.add(vehicleId);

      const lat = bus.lat ?? bus.latitude;
      const lon = bus.lon ?? bus.longitude;
      if (typeof lat !== 'number' || typeof lon !== 'number') continue;

      const bearing = bus.bearing ?? bus.heading ?? 0;
      const routeNumber = bus.routeNumber || bus.line || bus.lineId || bus.route_short_name || '';

      const routeId = bus.routeId || bus.route_id || bus.lineId || bus.line;
      const color = getRouteColor ? getRouteColor(routeId) : '#00ff88';

      try {
        let marker = this.busMarkers.get(vehicleId);

        if (marker) {
          // Update existing
          const el = marker.getElement();
          const arrow = el.querySelector('.bus-direction');
          if (arrow) arrow.style.transform = `rotate(${bearing}deg)`;

          this._animateMarker(marker, [lon, lat]);
        } else {
          // Create new 3D marker
          const el = this._create3DBusElement(bearing, color, routeNumber);
          
          marker = new mapboxgl.Marker({
            element: el,
            anchor: 'center',
            rotationAlignment: 'map',
            // ✅ שינוי מינימלי בלבד:
            // במקום "map" (שנשכב עם ה-pitch ונראה שטוח) -> "viewport" (נשאר מול המסך)
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

    // Remove inactive markers
    for (const [id, marker] of this.busMarkers.entries()) {
      if (!activeIds.has(id)) {
        try { marker.remove(); } catch (e) {}
        this.busMarkers.delete(id);
      }
    }
  }

  // Smooth marker animation
  _animateMarker(marker, end) {
    try {
      const start = marker.getLngLat();
      const duration = 800;

      const startTime = performance.now();

      const animate = (time) => {
        const progress = Math.min((time - startTime) / duration, 1);
        const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

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