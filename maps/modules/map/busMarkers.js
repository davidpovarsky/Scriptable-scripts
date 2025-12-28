// modules/map/busMarkers.js
// אחראי על ציור אוטובוסים תלת-מימדיים על המפה - Mapbox Model Source version
// משתמש ב-Model Source API של Mapbox (כמו בדוגמת המטוס) במקום Custom Layer

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map(); // For tracking bus instances
    this.modelLoaded = false;

    // GLB Model URL
    this.GLB_URL = "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb";

    // הגדרות כיוון המודל
    // bearing הוא הכיוון שהאוטובוס צריך לנסוע אליו (0°=צפון, 90°=מזרח)
    // אם המודל שלך פונה "לרוחב" במקור, תזדקק ל-offset של 90°
    this.MODEL_YAW_OFFSET_DEG = 90; // התאם לפי הצורך: 0, 90, 180, 270

    // הגדרות סיבוב בסיס (roll, pitch, yaw) במעלות
    // roll (X): הטיה צידית, pitch (Y): הטיה קדימה/אחורה, yaw (Z): כיוון אופקי
    this.MODEL_BASE_ORIENTATION = [0, 0, 0]; // [roll, pitch, yaw]

    // הגדרות סקאלה - המודל יתאים אוטומטית לזום
    this.MODEL_BASE_SCALE = 1.0; // גודל בסיס

    // Animation settings
    this.ANIMATION_DURATION = 2000; // ms
    this.SMOOTHING_FACTOR = 0.15; // For bearing interpolation (0-1)

    // Route number badges (Mapbox Markers)
    this.routeBadges = new Map();

    // Bus animation data
    this.busData = new Map();

    // Debug
    this.DEBUG_LOG = false;
    this.DEBUG_LOG_INTERVAL = 2000;
    this._lastDebugTime = 0;

    console.log("🚌 BusMarkers initialized (Mapbox Model Source)");

    // Initialize model source when map is ready
    this._initializeModelSource();
  }

  _initializeModelSource() {
    if (!this.map) return;

    const initSource = () => {
      try {
        // בדיקה אם ה-source כבר קיים
        if (this.map.getSource('buses-model-source')) {
          console.log("ℹ️ Model source already exists");
          this.modelLoaded = true;
          return;
        }

        // יצירת Model Source
        this.map.addSource('buses-model-source', {
          type: 'model',
          models: {} // נתחיל עם אובייקט ריק
        });

        console.log("✅ Model source created");

        // הוספת Model Layer
        if (!this.map.getLayer('buses-model-layer')) {
          this.map.addLayer({
            id: 'buses-model-layer',
            type: 'model',
            source: 'buses-model-source',
            paint: {
              // Scale המודל מתאים אוטומטית לזום
              'model-scale': [
                'interpolate',
                ['exponential', 0.5],
                ['zoom'],
                10.0,
                ['literal', [100.0, 100.0, 100.0]],
                16.0,
                ['literal', [1.0, 1.0, 1.0]]
              ],
              'model-type': 'location-indicator',
              'model-rotation': [0, 0, 0], // יעודכן דינמית
              'model-opacity': 1.0
            }
          });

          console.log("✅ Model layer created");
        }

        this.modelLoaded = true;

      } catch (e) {
        console.error("❌ Error initializing model source:", e);
      }
    };

    // נסה לאתחל כשה-map מוכן
    if (this.map.loaded()) {
      initSource();
    } else {
      this.map.once('load', initSource);
    }
  }

  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map || !this.modelLoaded) {
      if (!this._warnedNotReady) {
        console.log("⏳ Map or model not ready yet");
        this._warnedNotReady = true;
      }
      return;
    }

    if (!Array.isArray(vehicles)) return;

    const shapeLatLngs = shapeCoords ? shapeCoords.map(c => [c[0], c[1]]) : [];

    vehicles.forEach(v => {
      try {
        let lon = v.lon;
        let lat = v.lat;

        // אם אין קואורדינטות, נסה לחשב מה-shape
        if ((!lat || !lon) && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
          const idx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
          const point = shapeLatLngs[idx];
          if (point) {
            lon = point[0];
            lat = point[1];
          }
        }

        if (lat && lon) {
          let bearing = v.bearing;

          // חישוב bearing מה-shape אם לא זמין
          if (typeof bearing !== 'number' && typeof v.positionOnLine === 'number' && shapeLatLngs.length > 1) {
            bearing = this.calculateBearing(shapeLatLngs, v.positionOnLine);
          }

          bearing = bearing || 0;

          const vehicleId = v.vehicleId || `${v.routeNumber || 'bus'}-${v.tripId || Math.random()}`;
          const routeNumber = v.routeNumber || v.lineNumber || '';

          this.updateBusModel(vehicleId, lon, lat, bearing, color, routeNumber);
        }
      } catch (e) {
        console.error("❌ Error processing vehicle:", e);
      }
    });
  }

  updateBusModel(vehicleId, lon, lat, bearing, color, routeNumber) {
    if (!this.map || !this.modelLoaded) return;

    try {
      const modelSource = this.map.getSource('buses-model-source');
      if (!modelSource) return;

      // קבל או צור נתוני אוטובוס
      let data = this.busData.get(vehicleId);
      if (!data) {
        data = {
          currentLon: lon,
          currentLat: lat,
          smoothedBearing: bearing,
          startLon: lon,
          startLat: lat,
          targetLon: lon,
          targetLat: lat,
          animationStartTime: null
        };
        this.busData.set(vehicleId, data);
      }

      // חישוב המרחק מהמיקום הקודם
      const oldLon = data.currentLon;
      const oldLat = data.currentLat;
      const distance = Math.sqrt(
        Math.pow(lon - oldLon, 2) + Math.pow(lat - oldLat, 2)
      );

      // התחל אנימציה אם יש תזוזה משמעותית
      if (distance > 0.00001) {
        data.startLon = oldLon;
        data.startLat = oldLat;
        data.targetLon = lon;
        data.targetLat = lat;
        data.animationStartTime = performance.now();
      }

      // חישוב מיקום נוכחי (עם אנימציה)
      let currentLon = lon;
      let currentLat = lat;

      if (data.animationStartTime) {
        const elapsed = performance.now() - data.animationStartTime;
        const progress = Math.min(elapsed / this.ANIMATION_DURATION, 1);
        
        // Easing function (ease-out quad)
        const eased = progress * (2 - progress);

        currentLon = data.startLon + (data.targetLon - data.startLon) * eased;
        currentLat = data.startLat + (data.targetLat - data.startLat) * eased;

        data.currentLon = currentLon;
        data.currentLat = currentLat;

        if (progress >= 1) {
          data.animationStartTime = null;
        }
      } else {
        data.currentLon = currentLon;
        data.currentLat = currentLat;
      }

      // חישוב כיוון מוחלק (interpolated bearing)
      let targetBearing = bearing + this.MODEL_YAW_OFFSET_DEG;
      
      // Unwrap angles to nearest (avoid 359° -> 1° jump)
      if (data.smoothedBearing !== null) {
        const delta = this._wrap180(targetBearing - data.smoothedBearing);
        data.smoothedBearing += delta * this.SMOOTHING_FACTOR;
      } else {
        data.smoothedBearing = targetBearing;
      }

      // עדכון המודל ב-source
      const modelSpec = {};
      modelSpec[vehicleId] = {
        uri: this.GLB_URL,
        position: [currentLon, currentLat],
        orientation: [
          this.MODEL_BASE_ORIENTATION[0], // roll
          this.MODEL_BASE_ORIENTATION[1], // pitch
          data.smoothedBearing // yaw
        ]
      };

      // עדכון ה-models ב-source
      modelSource.setModels(modelSpec);

      // בדיקה האם זה המודל הראשון - אם כן, הוסף אותו למפה
      if (!this.busMarkers.has(vehicleId)) {
        this.busMarkers.set(vehicleId, true);
        console.log(`✅ Bus model ${vehicleId} added to map`);
      }

      // עדכון תג מספר קו (Marker badge)
      if (routeNumber) {
        this._updateRouteBadge(vehicleId, currentLon, currentLat, color, routeNumber);
      }

      // Debug logging
      if (this.DEBUG_LOG) {
        const now = performance.now();
        if (now - this._lastDebugTime > this.DEBUG_LOG_INTERVAL) {
          console.log(`🧭 Bus ${vehicleId}: bearing=${bearing.toFixed(1)}°, smoothed=${data.smoothedBearing.toFixed(1)}°, pos=[${currentLon.toFixed(5)}, ${currentLat.toFixed(5)}]`);
          this._lastDebugTime = now;
        }
      }

    } catch (e) {
      console.error(`❌ Error updating bus model ${vehicleId}:`, e);
    }
  }

  _updateRouteBadge(vehicleId, lon, lat, color, routeNumber) {
    let badge = this.routeBadges.get(vehicleId);

    if (!badge) {
      const badgeEl = document.createElement('div');
      badgeEl.className = 'route-badge-3d-model';
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
        offset: [0, -15] // מעל המודל
      })
        .setLngLat([lon, lat])
        .addTo(this.map);

      this.routeBadges.set(vehicleId, badge);
    } else {
      badge.setLngLat([lon, lat]);
    }
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

  _wrap180(deg) {
    return ((deg + 180) % 360 + 360) % 360 - 180;
  }

  pruneMarkers(activeVehicleIds) {
    if (!activeVehicleIds || !(activeVehicleIds instanceof Set)) return;

    try {
      const modelSource = this.map.getSource('buses-model-source');
      if (!modelSource) return;

      // מחק מודלים שאינם פעילים
      const modelsToKeep = {};
      this.busMarkers.forEach((_, id) => {
        if (activeVehicleIds.has(id)) {
          const data = this.busData.get(id);
          if (data) {
            modelsToKeep[id] = {
              uri: this.GLB_URL,
              position: [data.currentLon, data.currentLat],
              orientation: [
                this.MODEL_BASE_ORIENTATION[0],
                this.MODEL_BASE_ORIENTATION[1],
                data.smoothedBearing
              ]
            };
          }
        } else {
          this.busMarkers.delete(id);
        }
      });

      modelSource.setModels(modelsToKeep);

      // מחק badges
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

      // מחק נתונים
      this.busData.forEach((_, id) => {
        if (!activeVehicleIds.has(id)) {
          this.busData.delete(id);
        }
      });

    } catch (e) {
      console.error("❌ Error pruning markers:", e);
    }
  }

  clearAll() {
    try {
      const modelSource = this.map.getSource('buses-model-source');
      if (modelSource) {
        modelSource.setModels({});
      }

      this.busMarkers.clear();

      this.routeBadges.forEach(badge => {
        try { if (badge && badge.remove) badge.remove(); } catch (e) {}
      });
      this.routeBadges.clear();

      this.busData.clear();
      console.log("🗑️ All buses cleared");
    } catch (e) {
      console.error("❌ Error clearing buses:", e);
    }
  }

  // Debug helpers
  enableDebugLogging() {
    this.DEBUG_LOG = true;
    console.log("🐛 Debug logging enabled");
  }

  disableDebugLogging() {
    this.DEBUG_LOG = false;
    console.log("🔇 Debug logging disabled");
  }

  // Adjust model orientation interactively
  setModelOrientation(roll, pitch, yaw) {
    this.MODEL_BASE_ORIENTATION = [roll, pitch, yaw];
    console.log(`🔧 Model orientation set to [${roll}, ${pitch}, ${yaw}]`);
  }

  setModelYawOffset(offset) {
    this.MODEL_YAW_OFFSET_DEG = offset;
    console.log(`🔧 Model yaw offset set to ${offset}°`);
  }
}