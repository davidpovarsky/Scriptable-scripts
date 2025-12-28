// modules/map/busMarkers.js
// 3D Buses (GLB) via Mapbox "model" source + setModels() (like the airplane demo)
// כולל: אנימציה חלקה, מניעת הבהובים, ניקוי רכבים, ו-fallback ל-CSS marker אם model-source לא נתמך.

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();

    // Fallback markers (CSS) אם אין model source
    this.busMarkers = new Map();

    // Route badges (DOM) – עובד גם עם מודל וגם עם fallback
    this.routeBadges = new Map();

    // מצב אנימציה
    this.busState = new Map(); // id -> { cur:{lon,lat,bearing}, tgt:{lon,lat,bearing}, lastTs }
    this._rafRunning = false;
    this._lastFrameTs = 0;

    // Model source/layer ids
    this.MODEL_SOURCE_ID = 'buses-3d-model-source';
    this.MODEL_LAYER_ID = 'buses-3d-model-layer';

    // ===== TUNING (אפשר לדרוס דרך window.* ב-view.js) =====
    this.BUS_GLB_URL = window.BUS_GLB_URL || 'https://storage.googleapis.com/gmp-maps-demos/p3d-map/assets/Airplane.glb'; // שים כאן את ה-GLB של האוטובוס שלך
    this.MODEL_ROLL_DEG = (typeof window.BUS_MODEL_ROLL_DEG === 'number') ? window.BUS_MODEL_ROLL_DEG : 0;
    this.MODEL_PITCH_DEG = (typeof window.BUS_MODEL_PITCH_DEG === 'number') ? window.BUS_MODEL_PITCH_DEG : 0;
    this.MODEL_YAW_OFFSET_DEG = (typeof window.BUS_MODEL_YAW_OFFSET_DEG === 'number') ? window.BUS_MODEL_YAW_OFFSET_DEG : 0;

    // כמו המטוס: לעיתים צריך +90 כדי ליישר את “האף” לכיוון bearing
    this.MODEL_MAP_BEARING_OFFSET_DEG =
      (typeof window.BUS_MODEL_MAP_BEARING_OFFSET_DEG === 'number') ? window.BUS_MODEL_MAP_BEARING_OFFSET_DEG : 90;

    // הרמה קלה מעל הקרקע כדי למנוע “שקיעה”
    this.MODEL_ALT_M = (typeof window.BUS_MODEL_ALT_M === 'number') ? window.BUS_MODEL_ALT_M : 0.0;

    // Scale לפי זום (הערכים האלה מאוד תלויים במידות המודל שלך)
    this.SCALE_Z12 = (typeof window.BUS_MODEL_SCALE_Z12 === 'number') ? window.BUS_MODEL_SCALE_Z12 : 0.6;
    this.SCALE_Z16 = (typeof window.BUS_MODEL_SCALE_Z16 === 'number') ? window.BUS_MODEL_SCALE_Z16 : 1.0;
    this.SCALE_Z20 = (typeof window.BUS_MODEL_SCALE_Z20 === 'number') ? window.BUS_MODEL_SCALE_Z20 : 1.4;

    // אנימציה (half-life במילישניות; קטן יותר = מהיר יותר)
    this.POS_HALF_LIFE_MS = (typeof window.BUS_ANIM_POS_HALF_LIFE_MS === 'number') ? window.BUS_ANIM_POS_HALF_LIFE_MS : 350;
    this.BEAR_HALF_LIFE_MS = (typeof window.BUS_ANIM_BEAR_HALF_LIFE_MS === 'number') ? window.BUS_ANIM_BEAR_HALF_LIFE_MS : 250;

    // האם הצלחנו להפעיל model-source?
    this.modelMode = false;

    console.log("🚌 BusMarkers initialized (Model Source like airplane)");

    // ננסה להפעיל model mode
    this._ensureModelSourceAndLayer();
  }

  // ==========================================================
  // Public API (נקרא מ-app.js)
  // ==========================================================
  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map || !Array.isArray(vehicles)) return;

    const shapeLatLngs = Array.isArray(shapeCoords) ? shapeCoords.map(c => [c[0], c[1]]) : [];

    // עדכון targets
    for (const v of vehicles) {
      try {
        const id = this._stableVehicleId(v);
        let lon = v.lon;
        let lat = v.lat;

        // אם אין מיקום מדויק - positionOnLine
        if ((!lat || !lon) && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
          const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
          const pt = shapeLatLngs[idx];
          if (pt) { lon = pt[0]; lat = pt[1]; }
        }

        if (!lat || !lon) continue;

        // bearing: אם אין bearing מהשרת – נחשב מהמסלול
        let bearing = (typeof v.bearing === 'number') ? v.bearing : null;
        if (bearing == null && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
          bearing = this.calculateBearing(shapeLatLngs, v.positionOnLine);
        }
        if (bearing == null) bearing = 0;

        // שמירה ל-state
        const now = performance.now();
        const prev = this.busState.get(id);

        if (!prev) {
          this.busState.set(id, {
            cur: { lon, lat, bearing },
            tgt: { lon, lat, bearing },
            lastTs: now,
            routeNumber: v.routeNumber || ''
          });
        } else {
          prev.tgt.lon = lon;
          prev.tgt.lat = lat;
          prev.tgt.bearing = bearing;
          prev.lastTs = now;
          prev.routeNumber = v.routeNumber || prev.routeNumber || '';
        }

      } catch (e) {
        console.error("❌ drawBuses vehicle error:", e);
      }
    }

    // הפעלת RAF אחד לכל האוטובוסים
    this._startRAFIfNeeded();

    // (אופציונלי) צבע/מספר קו לבאדג' – נשמר רק ל-DOM badges
    // בפועל נעדכן אותם בפריים לפי מצב current.
  }

  pruneMarkers(activeVehicleIds) {
    if (!activeVehicleIds || !(activeVehicleIds instanceof Set)) return;

    // ניקוי state
    for (const id of Array.from(this.busState.keys())) {
      if (!activeVehicleIds.has(id)) {
        this.busState.delete(id);
      }
    }

    // ניקוי fallback markers
    for (const [id, marker] of this.busMarkers.entries()) {
      if (!activeVehicleIds.has(id)) {
        try { marker.remove(); } catch (e) {}
        this.busMarkers.delete(id);
      }
    }

    // ניקוי badges
    for (const [id, badge] of this.routeBadges.entries()) {
      if (!activeVehicleIds.has(id)) {
        try { badge.remove(); } catch (e) {}
        this.routeBadges.delete(id);
      }
    }

    // push אחרי ניקוי כדי להסיר מודלים שנעלמו
    if (this.modelMode) this._pushModelsToMap();
  }

  clearAll() {
    for (const m of this.busMarkers.values()) {
      try { m.remove(); } catch (e) {}
    }
    this.busMarkers.clear();

    for (const b of this.routeBadges.values()) {
      try { b.remove(); } catch (e) {}
    }
    this.routeBadges.clear();

    this.busState.clear();

    if (this.modelMode) {
      try {
        const src = this.map.getSource(this.MODEL_SOURCE_ID);
        if (src && src.setModels) src.setModels({});
      } catch (e) {}
    }

    console.log("🗑️ All buses cleared");
  }

  // ==========================================================
  // Model-source mode (like airplane)
  // ==========================================================
  _ensureModelSourceAndLayer() {
    if (!this.map) return;

    // אם המפה עוד לא ב-load – ננסה שוב ב-load
    if (!this.map.isStyleLoaded || !this.map.isStyleLoaded()) {
      this.map.once('load', () => this._ensureModelSourceAndLayer());
      return;
    }

    try {
      // בדיקת תמיכה: ננסה להוסיף source מסוג model
      if (!this.map.getSource(this.MODEL_SOURCE_ID)) {
        this.map.addSource(this.MODEL_SOURCE_ID, {
          type: 'model',
          models: {}
        });
      }

      if (!this.map.getLayer(this.MODEL_LAYER_ID)) {
        this.map.addLayer({
          id: this.MODEL_LAYER_ID,
          type: 'model',
          source: this.MODEL_SOURCE_ID,
          // אם יש style “standard” אפשר slot. ב-streets זה לרוב לא מזיק:
          slot: 'top',
          paint: {
            'model-translation': ['literal', [0, 0, this.MODEL_ALT_M]],
            'model-scale': [
              'interpolate', ['linear'], ['zoom'],
              12, ['literal', [this.SCALE_Z12, this.SCALE_Z12, this.SCALE_Z12]],
              16, ['literal', [this.SCALE_Z16, this.SCALE_Z16, this.SCALE_Z16]],
              20, ['literal', [this.SCALE_Z20, this.SCALE_Z20, this.SCALE_Z20]]
            ]
          }
        });
      }

      const src = this.map.getSource(this.MODEL_SOURCE_ID);
      if (src && typeof src.setModels === 'function') {
        this.modelMode = true;
        console.log("✅ Model-source enabled for buses (setModels available)");
      } else {
        this.modelMode = false;
        console.warn("⚠️ Model source exists but setModels() not available – fallback to CSS markers");
      }

    } catch (e) {
      this.modelMode = false;
      console.warn("⚠️ Model-source not supported in this Mapbox build – fallback to CSS markers:", e);
    }
  }

  _pushModelsToMap() {
    if (!this.modelMode) return;

    const src = this.map.getSource(this.MODEL_SOURCE_ID);
    if (!src || typeof src.setModels !== 'function') return;

    // בניית modelsSpec לכל הרכבים הפעילים (כמו המטוס: position + orientation)  [oai_citation:1‡מטוס תלת מימד.html](sediment://file_00000000a1f871fd8890ad7cb6a1b596)
    const modelsSpec = {};

    for (const [id, st] of this.busState.entries()) {
      const yaw = (st.cur.bearing || 0) + this.MODEL_MAP_BEARING_OFFSET_DEG + this.MODEL_YAW_OFFSET_DEG;

      modelsSpec[id] = {
        uri: this.BUS_GLB_URL,
        position: [st.cur.lon, st.cur.lat],
        orientation: [
          this.MODEL_ROLL_DEG,
          this.MODEL_PITCH_DEG,
          yaw
        ]
      };
    }

    try {
      src.setModels(modelsSpec);
    } catch (e) {
      console.error("❌ setModels failed:", e);
      this.modelMode = false; // ניפול לפולבאק אם יש תקלה
    }
  }

  // ==========================================================
  // RAF animation loop (אחד לכולם)
  // ==========================================================
  _startRAFIfNeeded() {
    if (this._rafRunning) return;
    this._rafRunning = true;
    this._lastFrameTs = performance.now();

   истр
    requestAnimationFrame((ts) => this._frame(ts));
  }

  _frame(ts) {
    if (!this._rafRunning) return;

    const dt = Math.max(0, ts - this._lastFrameTs);
    this._lastFrameTs = ts;

    // smoothing factors
    const posA = this._halfLifeAlpha(dt, this.POS_HALF_LIFE_MS);
    const bearA = this._halfLifeAlpha(dt, this.BEAR_HALF_LIFE_MS);

    // עדכון current -> target
    for (const st of this.busState.values()) {
      // position
      st.cur.lon = this._lerp(st.cur.lon, st.tgt.lon, posA);
      st.cur.lat = this._lerp(st.cur.lat, st.tgt.lat, posA);

      // bearing (unwrap)
      const tgtUnwrapped = this.unwrapToNearest(st.cur.bearing, st.tgt.bearing);
      st.cur.bearing = this._lerp(st.cur.bearing, tgtUnwrapped, bearA);
      st.cur.bearing = (st.cur.bearing % 360 + 360) % 360;
    }

    // push מודלים / או fallback marker
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
    // alpha = 1 - 0.5^(dt/halfLife)
    return 1 - Math.pow(0.5, dtMs / halfLifeMs);
  }

  // ==========================================================
  // Fallback: CSS markers (שומר את ההתנהגות הישנה שלך)
  // ==========================================================
  _updateFallbackMarkers() {
    for (const [id, st] of this.busState.entries()) {
      const lon = st.cur.lon;
      const lat = st.cur.lat;
      const bearing = st.cur.bearing;

      let marker = this.busMarkers.get(id);
      if (!marker) {
        const el = this._create3DBusElement(bearing, "#1976d2", st.routeNumber);
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

  // ==========================================================
  // Badges (DOM) – מצויר מעל המודלים
  // ==========================================================
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
  // Helpers
  // ==========================================================
  _stableVehicleId(v) {
    // חשוב: בלי Math.random כדי שלא יהיה “הבהוב”/יצירה מחדש
    // ננסה כמה שדות נפוצים
    const id =
      v.vehicleId ??
      v.vid ??
      v.tripId ??
      v.id ??
      null;

    if (id != null && id !== '') return String(id);

    // fallback יציב יחסית
    const rn = v.routeNumber ?? 'R';
    const dir = v.direction ?? '';
    const trip = v.tripId ?? '';
    return `${rn}-${dir}-${trip}`.replace(/\s+/g, '');
  }

  calculateBearing(shapeLatLngs, positionOnLine) {
    const idx = Math.floor(positionOnLine * (shapeLatLngs.length - 1));
    if (idx < shapeLatLngs.length - 1) {
      const start = shapeLatLngs[idx];
      const end = shapeLatLngs[idx + 1];
      return this.mapManager.getBearing(start, end);
    }
    return 0;
  }

  wrap180(deg) {
    return ((deg + 180) % 360 + 360) % 360 - 180;
  }

  unwrapToNearest(prevDeg, targetDeg) {
    const delta = this.wrap180(targetDeg - prevDeg);
    return prevDeg + delta;
  }

  _lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }
}