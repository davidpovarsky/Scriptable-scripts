// modules/map/busMarkers.js
// אחראי על ציור אוטובוסים תלת-מימדיים על המפה - Mapbox version with GLB models
// משתמש ב-Custom Layer של Three.js לציור מודלי GLB

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map();
    this.modelLoaded = false;

    // GLB Model settings (from the HTML example)
    this.GLB_URL = "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb";

    // הכיוונון הישן שלך (מהדוגמה)
    this.MODEL_YAW_OFFSET_DEG = -51.75;

    // ✅ חדש: יישור "קדימה" של המודל מול הכביש (ברירת מחדל 90° כי אצלך הוא "לרוחב")
    // אם עדיין לא מסתדר — נסה: 0 / 180 / 270
    this.MODEL_YAW_ALIGN_DEG = 90;

    this.MODEL_BASE_ROT_X_DEG = 88.25;
    this.MODEL_BASE_ROT_Y_DEG = 0;
    this.MODEL_BASE_ROT_Z_DEG = 0;
    this.OFFSET_EAST_M = 0;
    this.OFFSET_NORTH_M = 0;
    this.OFFSET_UP_M = 0;
    this.SCALE_MUL = 1;
    this.MODEL_SCALE = 1;
    this.MODEL_ALT_METERS = 0;
    this.FLIP_X_180 = false;

    // --- DEBUG / LOGGING (לא מציף) ---
    this.DEBUG_PATH_LOG = true;
    this.DEBUG_ROT_LOG = true;
    this.DEBUG_LOG_EVERY_MS = 2000;
    this._debugLastPathTs = 0;
    this._debugLastRotTs = 0;
    this._debugLastPath = null;

    // Three.js components
    this.threeInitialized = false;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.glbModelTemplate = null;
    this.busModels = new Map();

    // Quaternions
    this.qBase = null;
    this.qYaw = null;
    this.qOut = null;
    this.axisZ = null;

    // Bus data for smooth animation
    this.busData = new Map();

    // Route number badges
    this.routeBadges = new Map();

    console.log("🚌 BusMarkers initialized (GLB + Three.js)");

    // Check if THREE is available and initialize
    this.checkAndInitThree();
  }

  _debugMaybeLogPath(pathLabel) {
    if (!this.DEBUG_PATH_LOG) return;
    const now = performance.now();
    if (this._debugLastPath !== pathLabel || (now - this._debugLastPathTs) > this.DEBUG_LOG_EVERY_MS) {
      this._debugLastPath = pathLabel;
      this._debugLastPathTs = now;
      console.log(pathLabel);
    }
  }

  _debugMaybeLogRotation(vehicleId, bearing, targetYawDeg, smoothedYawDeg) {
    if (!this.DEBUG_ROT_LOG) return;
    const now = performance.now();
    if ((now - this._debugLastRotTs) > this.DEBUG_LOG_EVERY_MS) {
      this._debugLastRotTs = now;
      console.log(
        `🧭 ROT(GLB) id=${vehicleId} bearing=${Number(bearing).toFixed(1)}° ` +
        `targetYaw=${Number(targetYawDeg).toFixed(1)}° smooth=${Number(smoothedYawDeg).toFixed(1)}° ` +
        `(offset=${this.MODEL_YAW_OFFSET_DEG}° align=${this.MODEL_YAW_ALIGN_DEG}°)`
      );
    }
  }

  checkAndInitThree(attempt = 1, maxAttempts = 20) {
    if (typeof THREE !== 'undefined' && THREE.GLTFLoader) {
      console.log(`✅ Three.js found on attempt ${attempt}:`, THREE.REVISION);
      this.initThreeLayer();
    } else if (attempt < maxAttempts) {
      console.log(`⏳ Three.js not ready yet, retrying... (${attempt}/${maxAttempts})`);
      setTimeout(() => this.checkAndInitThree(attempt + 1, maxAttempts), 200);
    } else {
      console.warn("⚠️ Three.js not loaded after max attempts, using fallback 2D markers");
    }
  }

  initThreeLayer() {
    if (this.threeInitialized || !this.map) return;

    console.log("🎨 Initializing Three.js Custom Layer...");

    const self = this;

    const customLayer = {
      id: 'buses-3d-layer',
      type: 'custom',
      renderingMode: '3d',

      onAdd: function(map, gl) {
        self.scene = new THREE.Scene();
        self.camera = new THREE.Camera();
        self.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true
        });
        self.renderer.autoClear = false;

        self.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const dir = new THREE.DirectionalLight(0xffffff, 0.9);
        dir.position.set(10, -10, 20);
        self.scene.add(dir);

        self.qBase = new THREE.Quaternion();
        self.qYaw = new THREE.Quaternion();
        self.qOut = new THREE.Quaternion();
        self.axisZ = new THREE.Vector3(0, 0, 1);
        self.updateBaseQuaternion();

        const loader = new THREE.GLTFLoader();
        loader.load(
          self.GLB_URL,
          (gltf) => {
            self.glbModelTemplate = gltf.scene;
            self.modelLoaded = true;
            console.log("✅ GLB model template loaded");
          },
          undefined,
          (err) => {
            console.error("❌ GLB load error:", err);
            self.modelLoaded = false;
          }
        );

        self.threeInitialized = true;
        console.log("✅ Three.js layer initialized");
      },

      render: function(gl, matrix) {
        if (!self.scene || !self.camera || !self.renderer) return;

        const now = performance.now();
        self.busModels.forEach((busModel, vehicleId) => {
          if (!busModel.userData) return;

          const data = busModel.userData;

          if (data.animationStartTime && data.startLon && data.startLat && data.targetLon && data.targetLat) {
            const elapsed = now - data.animationStartTime;
            const progress = Math.min(elapsed / data.animationDuration, 1);
            const eased = progress * (2 - progress);

            const currentLon = data.startLon + (data.targetLon - data.startLon) * eased;
            const currentLat = data.startLat + (data.targetLat - data.startLat) * eased;

            data.currentLon = currentLon;
            data.currentLat = currentLat;

            const mc = mapboxgl.MercatorCoordinate.fromLngLat(
              { lng: currentLon, lat: currentLat },
              self.MODEL_ALT_METERS
            );
            const s = mc.meterInMercatorCoordinateUnits();

            busModel.position.set(
              mc.x + self.OFFSET_EAST_M * s,
              mc.y - self.OFFSET_NORTH_M * s,
              mc.z + self.OFFSET_UP_M * s
            );

            const finalScale = self.MODEL_SCALE * s * self.SCALE_MUL;
            busModel.scale.set(finalScale, finalScale, finalScale);

            const badge = self.routeBadges.get(vehicleId);
            if (badge) badge.setLngLat([currentLon, currentLat]);

            if (progress >= 1) data.animationStartTime = null;
          }
        });

        self.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
        self.renderer.state.reset();
        self.renderer.render(self.scene, self.camera);
        self.map.triggerRepaint();
      }
    };

    try {
      if (!this.map.getLayer('buses-3d-layer')) {
        this.map.addLayer(customLayer);
        console.log("✅ Three.js layer added to map");
      } else {
        console.log("ℹ️ Layer already exists");
      }
    } catch (e) {
      console.error("❌ Error adding Three.js layer:", e);
      console.log("Will retry when map style is fully loaded...");
      this.map.once('styledata', () => {
        try {
          if (!this.map.getLayer('buses-3d-layer')) {
            this.map.addLayer(customLayer);
            console.log("✅ Three.js layer added after styledata");
          }
        } catch (e2) {
          console.error("❌ Failed to add layer even after styledata:", e2);
        }
      });
    }
  }

  updateBaseQuaternion() {
    if (!this.qBase) return;

    const deg2rad = Math.PI / 180;
    let rxDeg = this.MODEL_BASE_ROT_X_DEG + (this.FLIP_X_180 ? 180 : 0);
    let ryDeg = this.MODEL_BASE_ROT_Y_DEG;
    let rzDeg = this.MODEL_BASE_ROT_Z_DEG;

    const e = new THREE.Euler(rxDeg * deg2rad, ryDeg * deg2rad, rzDeg * deg2rad, "XYZ");
    this.qBase.setFromEuler(e);
  }

  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map) return;
    if (!Array.isArray(vehicles)) return;

    const shapeLatLngs = shapeCoords ? shapeCoords.map(c => [c[0], c[1]]) : [];

    vehicles.forEach(v => {
      try {
        let lon = v.lon;
        let lat = v.lat;

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
          let bearing = v.bearing || 0;

          if (!v.bearing && shapeLatLngs.length > 1 && v.positionOnLine) {
            bearing = this.calculateBearing(shapeLatLngs, v.positionOnLine);
          }

          const existingData = this.busData.get(vehicleId);
          this.busData.set(vehicleId, {
            lon, lat, bearing, color,
            routeNumber: v.routeNumber,
            yawDegSmoothed: existingData?.yawDegSmoothed || null
          });

          if (this.modelLoaded && this.glbModelTemplate && this.threeInitialized) {
            this.updateGLBBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
          } else {
            this.draw3DBusFallback(vehicleId, lon, lat, bearing, color, v.routeNumber);
          }
        }
      } catch (e) {
        console.error("❌ Error drawing bus:", e);
      }
    });
  }

  updateGLBBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    this._debugMaybeLogPath("✅ GLB path (Three.js/GLB models)");
    if (!this.scene || !this.glbModelTemplate) return;

    let busModel = this.busModels.get(vehicleId);

    if (!busModel) {
      busModel = this.glbModelTemplate.clone();
      this.scene.add(busModel);
      this.busModels.set(vehicleId, busModel);
      console.log(`🚌 Created GLB model for bus ${vehicleId}`);

      const mc = mapboxgl.MercatorCoordinate.fromLngLat(
        { lng: lon, lat: lat },
        this.MODEL_ALT_METERS
      );
      const s = mc.meterInMercatorCoordinateUnits();

      busModel.position.set(
        mc.x + this.OFFSET_EAST_M * s,
        mc.y - this.OFFSET_NORTH_M * s,
        mc.z + this.OFFSET_UP_M * s
      );

      const finalScale = this.MODEL_SCALE * s * this.SCALE_MUL;
      busModel.scale.set(finalScale, finalScale, finalScale);

      busModel.userData = {
        routeNumber,
        color,
        targetLon: lon,
        targetLat: lat,
        currentLon: lon,
        currentLat: lat,
        animationStartTime: null
      };
    }

    const data = this.busData.get(vehicleId);
    if (!data) return;

    const oldLon = busModel.userData.currentLon || lon;
    const oldLat = busModel.userData.currentLat || lat;
    const distance = Math.sqrt(
      Math.pow(lon - oldLon, 2) + Math.pow(lat - oldLat, 2)
    );

    if (distance > 0.00001) {
      busModel.userData.startLon = oldLon;
      busModel.userData.startLat = oldLat;
      busModel.userData.targetLon = lon;
      busModel.userData.targetLat = lat;
      busModel.userData.animationStartTime = performance.now();
      busModel.userData.animationDuration = 2000;
    }

    // ✅ הכי חשוב:
    // bearing הוא כבר 0=צפון, 90=מזרח.
    // אנחנו מוסיפים "OFFSET" (הכוונון הישן שלך) + "ALIGN" (חדש: 90° לתיקון רוחב)
    let targetYawDeg = bearing + this.MODEL_YAW_OFFSET_DEG + this.MODEL_YAW_ALIGN_DEG;

    if (data.yawDegSmoothed == null) {
      data.yawDegSmoothed = targetYawDeg;
    } else {
      data.yawDegSmoothed = this.unwrapToNearest(data.yawDegSmoothed, targetYawDeg);
    }

    const deg2rad = Math.PI / 180;
    const yawRad = data.yawDegSmoothed * deg2rad;

    // Quaternion composition:
    // qOut = qYaw * qBase  (קודם מיישרים מודל עם qBase ואז מסובבים סביב Z)
    // אם עדיין מוזר אצלך — נסה לשנות ל-true (כמעט תמיד אחד מהשניים)
    const USE_BASE_THEN_YAW = false;

    this.qYaw.setFromAxisAngle(this.axisZ, yawRad);

    if (USE_BASE_THEN_YAW) {
      this.qOut.copy(this.qBase).multiply(this.qYaw);
    } else {
      this.qOut.copy(this.qYaw).multiply(this.qBase);
    }

    busModel.quaternion.copy(this.qOut);

    this._debugMaybeLogRotation(vehicleId, bearing, targetYawDeg, data.yawDegSmoothed);

    if (routeNumber) {
      let badge = this.routeBadges.get(vehicleId);

      if (!badge) {
        const badgeEl = document.createElement('div');
        badgeEl.className = 'route-badge-3d-glb';
        badgeEl.style.cssText = `
          background: white;
          color: ${color};
          border: 2px solid ${color};
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: bold;
          font-size: 11px;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          pointer-events: none;
        `;
        badgeEl.textContent = routeNumber;

        badge = new mapboxgl.Marker({
          element: badgeEl,
          anchor: 'bottom',
          offset: [0, -10]
        })
          .setLngLat([lon, lat])
          .addTo(this.map);

        this.routeBadges.set(vehicleId, badge);
      }
    }
  }

  draw3DBusFallback(vehicleId, lon, lat, bearing, color, routeNumber) {
    this._debugMaybeLogPath("⚠️ FALLBACK path (2D/CSS markers)");

    let marker = this.busMarkers.get(vehicleId);

    if (marker) {
      this.animateBusTo(vehicleId, lon, lat, 2000);

      const el = marker.getElement();
      if (el) {
        const model = el.querySelector('.bus-3d-container');
        if (model) {
          model.style.transform = `rotateZ(${bearing}deg)`;
        }
      }
    } else {
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

    this.busModels.forEach((model, id) => {
      if (!activeVehicleIds.has(id)) {
        try {
          if (this.scene) this.scene.remove(model);
          this.busModels.delete(id);
        } catch (e) {
          console.error("❌ Error removing 3D model:", e);
        }
      }
    });

    this.routeBadges.forEach((badge, id) => {
      if (!activeVehicleIds.has(id)) {
        try {
          if (badge.remove) badge.remove();
          this.routeBadges.delete(id);
        } catch (e) {
          console.error("❌ Error removing badge:", e);
        }
      }
    });

    this.busData.forEach((data, id) => {
      if (!activeVehicleIds.has(id)) this.busData.delete(id);
    });
  }

  clearAll() {
    this.busMarkers.forEach(marker => {
      try { if (marker && marker.remove) marker.remove(); } catch (e) {}
    });
    this.busMarkers.clear();

    this.busModels.forEach(model => {
      try { if (this.scene) this.scene.remove(model); } catch (e) {}
    });
    this.busModels.clear();

    this.routeBadges.forEach(badge => {
      try { if (badge && badge.remove) badge.remove(); } catch (e) {}
    });
    this.routeBadges.clear();

    this.busData.clear();
    console.log("🗑️ All buses cleared");
  }

  animateBusTo(vehicleId, newLon, newLat, duration = 2000) {
    const marker = this.busMarkers.get(vehicleId);
    if (!marker) return;

    try {
      const start = marker.getLngLat();
      const end = [newLon, newLat];

      if (Math.abs(start.lng - end[0]) < 0.00001 && Math.abs(start.lat - end[1]) < 0.00001) return;

      let startTime = null;

      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const eased = progress * (2 - progress);

        const currentLng = start.lng + (end[0] - start.lng) * eased;
        const currentLat = start.lat + (end[1] - start.lat) * eased;

        marker.setLngLat([currentLng, currentLat]);

        if (progress < 1) requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    } catch (e) {
      console.error("❌ Error animating bus:", e);
    }
  }

  toggleFlip() {
    this.FLIP_X_180 = !this.FLIP_X_180;
    try { localStorage.setItem("bus_flip_x_180_v2", this.FLIP_X_180 ? "1" : "0"); } catch(e) {}
    this.updateBaseQuaternion();
    console.log(`🔄 Flip mode: ${this.FLIP_X_180 ? 'ON' : 'OFF'}`);
  }
}