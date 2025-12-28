// modules/map/busMarkers.js
// Buses: Prefer Mapbox "model" source + setModels() (like the airplane demo),
// but ALWAYS fallback to CSS markers if not supported.
// Also: stable vehicle IDs (NO Math.random) so pruneMarkers won't delete everything.

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();

    // --- runtime state ---
    this.busState = new Map();   // id -> {cur:{lon,lat,bearing}, tgt:{lon,lat,bearing}, routeNumber, lastTs}
    this._rafRunning = false;
    this._lastFrameTs = 0;

    // --- renderers ---
    this.modelMode = false;      // true if model source + setModels available
    this.busMarkers = new Map(); // fallback CSS markers
    this.routeBadges = new Map();// optional badge markers

    // --- model source/layer ---
    this.MODEL_SOURCE_ID = 'buses-model-source';
    this.MODEL_LAYER_ID  = 'buses-model-layer';

    // --- tuning (can be overridden from view.js via window.*) ---
    this.BUS_GLB_URL = window.BUS_GLB_URL || 'https://docs.mapbox.com/mapbox-gl-js/assets/airplane.glb';
    this.MODEL_ROLL_DEG  = (typeof window.BUS_MODEL_ROLL_DEG  === 'number') ? window.BUS_MODEL_ROLL_DEG  : 0;
    this.MODEL_PITCH_DEG = (typeof window.BUS_MODEL_PITCH_DEG === 'number') ? window.BUS_MODEL_PITCH_DEG : 0;

    // Like the airplane demo: orientation uses bearing (+90 often needed for forward axis)  [oai_citation:1‡Mapbox](https://docs.mapbox.com/mapbox-gl-js/example/add-3d-model-and-animate-along-route/)
    this.MODEL_MAP_BEARING_OFFSET_DEG =
      (typeof window.BUS_MODEL_MAP_BEARING_OFFSET_DEG === 'number') ? window.BUS_MODEL_MAP_BEARING_OFFSET_DEG : 90;

    this.MODEL_YAW_OFFSET_DEG =
      (typeof window.BUS_MODEL_YAW_OFFSET_DEG === 'number') ? window.BUS_MODEL_YAW_OFFSET_DEG : 0;

    this.MODEL_ALT_M =
      (typeof window.BUS_MODEL_ALT_M === 'number') ? window.BUS_MODEL_ALT_M : 0.0;

    // Zoom scale (tune to your GLB size)
    this.SCALE_Z12 = (typeof window.BUS_MODEL_SCALE_Z12 === 'number') ? window.BUS_MODEL_SCALE_Z12 : 0.6;
    this.SCALE_Z16 = (typeof window.BUS_MODEL_SCALE_Z16 === 'number') ? window.BUS_MODEL_SCALE_Z16 : 1.0;
    this.SCALE_Z20 = (typeof window.BUS_MODEL_SCALE_Z20 === 'number') ? window.BUS_MODEL_SCALE_Z20 : 1.4;

    // smoothing
    this.POS_HALF_LIFE_MS  = (typeof window.BUS_ANIM_POS_HALF_LIFE_MS  === 'number') ? window.BUS_ANIM_POS_HALF_LIFE_MS  : 350;
    this.BEAR_HALF_LIFE_MS = (typeof window.BUS_ANIM_BEAR_HALF_LIFE_MS === 'number') ? window.BUS_ANIM_BEAR_HALF_LIFE_MS : 250;

    console.log("🚌 BusMarkers initialized (Model Source + Fallback)");

    this._ensureModelSourceAndLayer();
  }

  // ==========================================================
  // IMPORTANT: One ID function used everywhere (app.js + draw + prune)
  // ==========================================================
  getVehicleId(v) {
    if (!v || typeof v !== 'object') return null;

    const id =
      v.vehicleId ??
      v.vid ??
      v.id ??
      v.tripId ??
      null;

    if (id != null && id !== '') return String(id);

    // fallback stable-ish (NO random)
    const rn  = (v.routeNumber != null) ? String(v.routeNumber) : 'R';
    const dir = (v.direction  != null) ? String(v.direction)  : '';
    const trip= (v.tripId     != null) ? String(v.tripId)     : '';
    return `${rn}-${dir}-${trip}`.replace(/\s+/g, '');
  }

  // ==========================================================
  // Public API
  // ==========================================================
  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map || !Array.isArray(vehicles)) return;

    const shapeLatLngs = Array.isArray(shapeCoords) ? shapeCoords.map(c => [c[0], c[1]]) : [];
    const now = performance.now();

    for (const v of vehicles) {
      try {
        const id = this.getVehicleId(v);
        if (!id) continue;

        // location
        let lon = v.lon;
        let lat = v.lat;

        // fallback: positionOnLine -> point on shape
        if ((!lat || !lon) && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
          const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
          const pt = shapeLatLngs[idx];
          if (pt) { lon = pt[0]; lat = pt[1]; }
        }

        if (!lat || !lon) continue;

        // bearing
        let bearing = (typeof v.bearing === 'number') ? v.bearing : null;
        if (bearing == null && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
          bearing = this._bearingFromShape(shapeLatLngs, v.positionOnLine);
        }
        if (bearing == null) bearing = 0;

        const prev = this.busState.get(id);
        if (!prev) {
          this.busState.set(id, {
            cur: { lon, lat, bearing },
            tgt: { lon, lat, bearing },
            routeNumber: v.routeNumber || '',
            lastTs: now
          });
        } else {
          prev.tgt.lon = lon;
          prev.tgt.lat = lat;
          prev.tgt.bearing = bearing;
          prev.routeNumber = v.routeNumber || prev.routeNumber || '';
          prev.lastTs = now;
        }

      } catch (e) {
        console.error("❌ drawBuses vehicle error:", (e && e.stack) ? e.stack : String(e));
      }
    }

    this._startRAFIfNeeded();
  }

  pruneMarkers(activeVehicleIds) {
    if (!(activeVehicleIds instanceof Set)) return;

    // state
    for (const id of Array.from(this.busState.keys())) {
      if (!activeVehicleIds.has(id)) this.busState.delete(id);
    }

    // fallback markers
    for (const [id, m] of this.busMarkers.entries()) {
      if (!activeVehicleIds.has(id)) {
        try { m.remove(); } catch (e) {}
        this.busMarkers.delete(id);
      }
    }

    // badges
    for (const [id, b] of this.routeBadges.entries()) {
      if (!activeVehicleIds.has(id)) {
        try { b.remove(); } catch (e) {}
        this.routeBadges.delete(id);
      }
    }

    // remove missing models
    if (this.modelMode) this._pushModelsToMap();
  }

  clearAll() {
    for (const m of this.busMarkers.values()) { try { m.remove(); } catch (e) {} }
    for (const b of this.routeBadges.values()) { try { b.remove(); } catch (e) {} }
    this.busMarkers.clear();
    this.routeBadges.clear();
    this.busState.clear();

    if (this.modelMode) {
      const src = this.map.getSource(this.MODEL_SOURCE_ID);
      if (src && src.setModels) src.setModels({});
    }
  }

  // ==========================================================
  // Model Source (like airplane)
  // ==========================================================
  _ensureModelSourceAndLayer() {
    if (!this.map) return;

    // wait until style is ready
    if (typeof this.map.isStyleLoaded === 'function' && !this.map.isStyleLoaded()) {
      this.map.once('load', () => this._ensureModelSourceAndLayer());
      return;
    }

    try {
      if (!this.map.getSource(this.MODEL_SOURCE_ID)) {
        this.map.addSource(this.MODEL_SOURCE_ID, { type: 'model', models: {} });
      }

      if (!this.map.getLayer(this.MODEL_LAYER_ID)) {
        this.map.addLayer({
          id: this.MODEL_LAYER_ID,
          type: 'model',
          source: this.MODEL_SOURCE_ID,
          paint: {
            'model-translation': [0, 0, this.MODEL_ALT_M],
            'model-scale': [
              'interpolate', ['exponential', 0.5], ['zoom'],
              12, [this.SCALE_Z12, this.SCALE_Z12, this.SCALE_Z12],
              16, [this.SCALE_Z16, this.SCALE_Z16, this.SCALE_Z16],
              20, [this.SCALE_Z20, this.SCALE_Z20, this.SCALE_Z20]
            ]
          }
        });
      }

      const src = this.map.getSource(this.MODEL_SOURCE_ID);
      this.modelMode = !!(src && typeof src.setModels === 'function');

      console.log(this.modelMode
        ? "✅ Model-source enabled for buses (setModels available)"
        : "⚠️ Model-source exists but setModels() not available → fallback to CSS markers"
      );
    } catch (e) {
      this.modelMode = false;
      console.warn("⚠️ Model-source failed → fallback to CSS markers:", (e && e.message) ? e.message : String(e));
    }
  }

  _pushModelsToMap() {
    if (!this.modelMode) return;

    const src = this.map.getSource(this.MODEL_SOURCE_ID);
    if (!src || typeof src.setModels !== 'function') return;

    const modelsSpec = {};

    for (const [id, st] of this.busState.entries()) {
      const yaw = (st.cur.bearing || 0) + this.MODEL_MAP_BEARING_OFFSET_DEG + this.MODEL_YAW_OFFSET_DEG;

      // airplane demo: { uri, position, orientation }  [oai_citation:2‡Mapbox](https://docs.mapbox.com/mapbox-gl-js/example/add-3d-model-and-animate-along-route/)
      modelsSpec[id] = {
        uri: this.BUS_GLB_URL,
        position: [st.cur.lon, st.cur.lat],
        orientation: [this.MODEL_ROLL_DEG, this.MODEL_PITCH_DEG, yaw]
      };
    }

    try {
      src.setModels(modelsSpec);
    } catch (e) {
      console.error("❌ setModels failed → fallback to CSS markers:", (e && e.stack) ? e.stack : String(e));
      this.modelMode = false;
    }
  }

  // ==========================================================
  // RAF animation
  // ==========================================================
  _startRAFIfNeeded() {
    if (this._rafRunning) return;
    this._rafRunning = true;
    this._lastFrameTs = performance.now();
    requestAnimationFrame((ts) => this._frame(ts));
  }

  _frame(ts) {
    if (!this._rafRunning) return;

    const dt = Math.max(0, ts - this._lastFrameTs);
    this._lastFrameTs = ts;

    const posA  = this._halfLifeAlpha(dt, this.POS_HALF_LIFE_MS);
    const bearA = this._halfLifeAlpha(dt, this.BEAR_HALF_LIFE_MS);

    for (const st of this.busState.values()) {
      st.cur.lon = this._lerp(st.cur.lon, st.tgt.lon, posA);
      st.cur.lat = this._lerp(st.cur.lat, st.tgt.lat, posA);

      const tgtUnwrapped = this._unwrapToNearest(st.cur.bearing, st.tgt.bearing);
      st.cur.bearing = this._lerp(st.cur.bearing, tgtUnwrapped, bearA);
      st.cur.bearing = (st.cur.bearing % 360 + 360) % 360;
    }

    if (this.modelMode) {
      this._pushModelsToMap();
      this._updateBadgesFromState();
    } else {
      this._updateFallbackMarkers();
      this._updateBadgesFromState();
    }

    requestAnimationFrame((t) => this._frame(t));
  }

  _halfLifeAlpha(dtMs, halfLifeMs) {
    if (!halfLifeMs || halfLifeMs <= 0) return 1;
    return 1 - Math.pow(0.5, dtMs / halfLifeMs);
  }

  // ==========================================================
  // Fallback CSS markers (uses your existing CSS classes)
  // ==========================================================
  _updateFallbackMarkers() {
    for (const [id, st] of this.busState.entries()) {
      const lon = st.cur.lon;
      const lat = st.cur.lat;
      const bearing = st.cur.bearing;
      const color = "#1976d2";

      let marker = this.busMarkers.get(id);
      if (!marker) {
        const el = this._create3DBusElement(bearing, color, st.routeNumber);
        marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
          rotationAlignment: 'map',
          pitchAlignment: 'map'
        }).setLngLat([lon, lat]).addTo(this.map);

        this.busMarkers.set(id, marker);
      } else {
        marker.setLngLat([lon, lat]);
        const el = marker.getElement();
        const model = el && el.querySelector('.bus-3d-container');
        if (model) model.style.transform = `rotateZ(${bearing}deg)`;
      }
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

  _updateBadgesFromState() {
    for (const [id, st] of this.busState.entries()) {
      const routeNumber = st.routeNumber || '';
      if (!routeNumber) continue;

      let badge = this.routeBadges.get(id);
      if (!badge) {
        const el = document.createElement('div');
        el.className = 'route-badge-3d';
        el.textContent = routeNumber;

        badge = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([st.cur.lon, st.cur.lat])
          .addTo(this.map);

        this.routeBadges.set(id, badge);
      } else {
        badge.setLngLat([st.cur.lon, st.cur.lat]);
      }
    }
  }

  // ==========================================================
  // math helpers
  // ==========================================================
  _lerp(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    return a + (b - a) * t;
  }

  _wrap180(deg) {
    return ((deg + 180) % 360 + 360) % 360 - 180;
  }

  _unwrapToNearest(prevDeg, targetDeg) {
    const delta = this._wrap180(targetDeg - prevDeg);
    return prevDeg + delta;
  }

  _bearingFromShape(shapeLatLngs, positionOnLine) {
    const idx = Math.floor(positionOnLine * (shapeLatLngs.length - 1));
    if (idx < shapeLatLngs.length - 1) {
      const start = shapeLatLngs[idx];
      const end = shapeLatLngs[idx + 1];
      return this.mapManager.getBearing(start, end);
    }
    return 0;
  }
}