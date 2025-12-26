// modules/map/busMarkers.js
// אחראי על ציור אוטובוסים תלת-ממדיים (HTML markers) על המפה
// כולל אנימציות תנועה, סיבוב לפי כיוון, ועוד

export default class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map();
    this.motionTrails = new Map();
    this.lastPositions = new Map();
    this.animations = new Map();
    this.isAnimating = false;
  }

  // Create 3D bus marker element
  createBusElement(bus, color) {
    const container = document.createElement('div');
    container.className = 'bus-marker-3d';
    container.dataset.busId = bus.id || bus.vehicleId || bus.vehicle_id || '';

    const busContainer = document.createElement('div');
    busContainer.className = 'bus-3d-container';

    const busModel = document.createElement('div');
    busModel.className = 'bus-3d-model';
    busModel.style.backgroundColor = color;

    // Add bus details
    const busBody = document.createElement('div');
    busBody.className = 'bus-3d-body';

    // Front windshield
    const front = document.createElement('div');
    front.className = 'bus-3d-front';

    // Side windows
    const windows = document.createElement('div');
    windows.className = 'bus-3d-windows';

    // Wheels
    const wheels = document.createElement('div');
    wheels.className = 'bus-3d-wheels';

    // Direction indicator
    const direction = document.createElement('div');
    direction.className = 'bus-direction';
    direction.innerHTML = '▲';

    // Add line number if available
    const lineNumber = document.createElement('div');
    lineNumber.className = 'bus-line-number';
    lineNumber.textContent = bus.line || bus.lineId || bus.route_short_name || '';

    // Assemble
    busBody.appendChild(front);
    busBody.appendChild(windows);
    busBody.appendChild(wheels);

    busModel.appendChild(busBody);
    busModel.appendChild(direction);
    if (lineNumber.textContent) busModel.appendChild(lineNumber);

    busContainer.appendChild(busModel);
    container.appendChild(busContainer);

    // Add click handler
    container.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onBusClick(bus);
    });

    return container;
  }

  // Update all bus markers
  updateBuses(buses, getRouteColor) {
    if (!this.map || !buses) return;

    const activeIds = new Set();

    buses.forEach(bus => {
      const id = bus.id || bus.vehicleId || bus.vehicle_id;
      if (!id) return;

      activeIds.add(id);

      const lat = bus.lat || bus.latitude;
      const lon = bus.lon || bus.longitude;
      if (typeof lat !== 'number' || typeof lon !== 'number') return;

      const bearing = bus.bearing || bus.heading || 0;
      const routeId = bus.routeId || bus.route_id || bus.lineId || bus.line;
      const color = getRouteColor ? getRouteColor(routeId) : '#00ff88';

      if (this.busMarkers.has(id)) {
        // Update existing marker position + rotation
        this.animateBusTo(id, [lon, lat], bearing);
      } else {
        // Create new marker
        const el = this.createBusElement(bus, color);

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
          rotationAlignment: 'map',
          pitchAlignment: 'viewport' // ✅ חשוב: לא "נשכב" עם ה-pitch של המפה
        })
          .setLngLat([lon, lat])
          .addTo(this.map);

        this.busMarkers.set(id, {
          marker,
          element: el,
          bus,
          color,
          lastBearing: bearing
        });

        this.lastPositions.set(id, [lon, lat]);
      }
    });

    // Remove markers that are no longer active
    this.busMarkers.forEach((data, id) => {
      if (!activeIds.has(id)) {
        try {
          data.marker.remove();
        } catch (e) {}
        this.busMarkers.delete(id);
        this.motionTrails.delete(id);
        this.lastPositions.delete(id);
        this.animations.delete(id);
      }
    });
  }

  // Animate bus movement smoothly
  animateBusTo(id, newPos, bearing) {
    const data = this.busMarkers.get(id);
    if (!data) return;

    const oldPos = this.lastPositions.get(id) || newPos;
    this.lastPositions.set(id, newPos);

    // Update bearing & visuals
    const el = data.element;
    const model = el.querySelector('.bus-3d-model');
    const dirEl = el.querySelector('.bus-direction');

    if (model && typeof bearing === 'number') {
      model.style.transform = model.style.transform || '';
      // Keep any existing transforms (CSS handles tilt), and apply rotateZ via CSS variable style
      model.style.setProperty('--busBearing', `${bearing}deg`);

      // Fallback: rotate direction arrow
      if (dirEl) {
        dirEl.style.transform = `rotate(${bearing}deg)`;
      }
    }

    // If animation already running for this bus, update target
    if (this.animations.has(id)) {
      const anim = this.animations.get(id);
      anim.to = newPos;
      anim.bearing = bearing;
      return;
    }

    // Start new animation
    const startTime = performance.now();
    const duration = 800; // ms

    const animData = {
      from: oldPos,
      to: newPos,
      start: startTime,
      duration,
      bearing
    };
    this.animations.set(id, animData);

    if (!this.isAnimating) {
      this.isAnimating = true;
      this.animationLoop();
    }
  }

  // Global animation loop
  animationLoop() {
    const now = performance.now();
    let stillAnimating = false;

    this.animations.forEach((anim, id) => {
      const data = this.busMarkers.get(id);
      if (!data) {
        this.animations.delete(id);
        return;
      }

      const progress = (now - anim.start) / anim.duration;

      if (progress >= 1) {
        // Finish
        data.marker.setLngLat(anim.to);
        this.animations.delete(id);
      } else {
        stillAnimating = true;
        const eased = this.easeInOutCubic(progress);
        const lon = anim.from[0] + (anim.to[0] - anim.from[0]) * eased;
        const lat = anim.from[1] + (anim.to[1] - anim.from[1]) * eased;
        data.marker.setLngLat([lon, lat]);
      }
    });

    if (stillAnimating) {
      requestAnimationFrame(() => this.animationLoop());
    } else {
      this.isAnimating = false;
    }
  }

  // Smooth easing
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Handle bus click
  onBusClick(bus) {
    // Dispatch a custom event for the UI to handle
    const event = new CustomEvent('busClick', { detail: { bus } });
    window.dispatchEvent(event);
  }

  // Optional: set visibility
  setVisible(visible) {
    this.busMarkers.forEach(({ element }) => {
      if (element) element.style.display = visible ? '' : 'none';
    });
  }

  // Cleanup
  destroy() {
    try {
      this.busMarkers.forEach(({ marker }) => {
        try { marker.remove(); } catch (e) {}
      });
      this.busMarkers.clear();
      this.motionTrails.clear();
      this.lastPositions.clear();
      this.animations.clear();
      this.isAnimating = false;
    } catch (e) {
      console.error("❌ Error destroying bus markers:", e);
    }
  }

  // Optional: debug animate single bus
  debugAnimateOne(id, to, bearing = 0) {
    try {
      this.animateBusTo(id, to, bearing);
    } catch (e) {
      console.error("❌ Error animating bus:", e);
    }
  }
}