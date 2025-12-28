// modules/map/busMarkers.js
// אחראי על ציור אוטובוסים תלת-מימדיים על המפה - Mapbox Model Source
// גרסה משופרת: משתמשת ב-Mapbox Model Source במקום Three.js Custom Layer

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map();
    this.modelLoaded = false;

    // GLB Model URL
    this.GLB_URL = "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb";

    // הגדרות כיוונון מודל
    this.MODEL_YAW_OFFSET_DEG = -51.75;  // הכיוונון הישן שלך
    this.MODEL_YAW_ALIGN_DEG = 90;       // יישור "קדימה" של המודל (0/90/180/270)
    
    // Scale והגדרות מיקום
    this.MODEL_SCALE = [1, 1, 1];        // [x, y, z] scale
    this.MODEL_ALT_METERS = 0;           // גובה מעל פני הקרקע

    // DEBUG logging (DISABLED for production)
    this.DEBUG_PATH_LOG = false;  // כבוי כדי למנוע קפיצות
    this.DEBUG_ROT_LOG = false;   // כבוי כדי למנוע קפיצות
    this.DEBUG_LOG_EVERY_MS = 2000;
    this._debugLastPathTs = 0;
    this._debugLastRotTs = 0;
    this._debugLastPath = null;

    // Bus data for smooth animation
    this.busData = new Map();

    // Route number badges
    this.routeBadges = new Map();

    console.log("🚌 BusMarkers initialized (Mapbox Model Source)");

    // Initialize when map is ready
    this.initModelSource();
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
        `🧭 ROT id=${vehicleId} bearing=${Number(bearing).toFixed(1)}° ` +
        `targetYaw=${Number(targetYawDeg).toFixed(1)}° smooth=${Number(smoothedYawDeg).toFixed(1)}° ` +
        `(offset=${this.MODEL_YAW_OFFSET_DEG}° align=${this.MODEL_YAW_ALIGN_DEG}°)`
      );
    }
  }

  initModelSource() {
    if (!this.map) {
      console.warn("⚠️ Map not ready for model source");
      return;
    }

    // Wait for map to be fully loaded
    const initSource = () => {
      try {
        // Add model source if it doesn't exist
        if (!this.map.getSource('buses-3d-source')) {
          this.map.addSource('buses-3d-source', {
            type: 'model',
            models: {} // Start with empty models, will add buses dynamically
          });
          console.log("✅ Model source 'buses-3d-source' added");
        }

        // Add model layer if it doesn't exist
        if (!this.map.getLayer('buses-3d-layer')) {
          this.map.addLayer({
            id: 'buses-3d-layer',
            type: 'model',
            source: 'buses-3d-source',
            paint: {
              'model-scale': [
                'interpolate',
                ['exponential', 0.5],
                ['zoom'],
                10, ['literal', [50.0, 50.0, 50.0]],
                15, ['literal', [5.0, 5.0, 5.0]],
                18, ['literal', [1.0, 1.0, 1.0]]
              ],
              'model-rotation': [0, 0, 0], // Will be updated per bus
              'model-opacity': 1.0
            }
          });
          console.log("✅ Model layer 'buses-3d-layer' added");
        }

        this.modelLoaded = true;
        console.log("✅ Model source initialized successfully");
      } catch (e) {
        console.error("❌ Error initializing model source:", e);
      }
    };

    // Check if map is already loaded
    if (this.map.isStyleLoaded()) {
      initSource();
    } else {
      // Wait for style to load
      this.map.once('load', initSource);
    }
  }

  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map) return;
    if (!Array.isArray(vehicles)) return;
    if (!this.modelLoaded) {
      this._debugMaybeLogPath("⏳ Model source not ready yet, using fallback");
      vehicles.forEach(v => {
        if (v.lat && v.lon) {
          const vehicleId = v.vehicleId || `${v.routeNumber}-${v.tripId || ''}`;
          this.draw2DBusFallback(vehicleId, v.lon, v.lat, v.bearing || 0, color, v.routeNumber);
        }
      });
      return;
    }

    this._debugMaybeLogPath("✅ Using Mapbox Model Source (3D GLB)");

    const shapeLatLngs = shapeCoords ? shapeCoords.map(c => [c[0], c[1]]) : [];

    vehicles.forEach(v => {
      try {
        let lon = v.lon;
        let lat = v.lat;

        // Fallback to position on line if no coordinates
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
          
          // Calculate bearing from shape if not provided
          if (bearing == null && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
            bearing = this.calculateBearing(shapeLatLngs, v.positionOnLine);
          }
          
          if (bearing == null) bearing = 0;

          const vehicleId = v.vehicleId || `${v.routeNumber}-${v.tripId || ''}`;
          this.draw3DBusModel(vehicleId, lon, lat, bearing, color, v.routeNumber);
        }
      } catch (e) {
        console.error("❌ Error drawing bus:", e);
      }
    });
  }

  draw3DBusModel(vehicleId, lon, lat, bearing, color, routeNumber) {
    try {
      const modelSource = this.map.getSource('buses-3d-source');
      if (!modelSource) {
        console.warn("⚠️ Model source not available");
        return;
      }

      // Get or create bus data
      let data = this.busData.get(vehicleId);
      if (!data) {
        data = {
          currentLon: lon,
          currentLat: lat,
          targetLon: lon,
          targetLat: lat,
          startLon: lon,
          startLat: lat,
          yawDegSmoothed: null,
          animationStartTime: null,
          animationDuration: 2000
        };
        this.busData.set(vehicleId, data);
      }

      // Calculate target yaw (bearing + offsets)
      // bearing is already 0=North, 90=East
      let targetYawDeg = bearing + this.MODEL_YAW_OFFSET_DEG + this.MODEL_YAW_ALIGN_DEG;

      // Smooth yaw rotation
      if (data.yawDegSmoothed == null) {
        data.yawDegSmoothed = targetYawDeg;
      } else {
        data.yawDegSmoothed = this.unwrapToNearest(data.yawDegSmoothed, targetYawDeg);
      }

      // Check if we need to animate position
      const oldLon = data.currentLon;
      const oldLat = data.currentLat;
      const distance = Math.sqrt(
        Math.pow(lon - oldLon, 2) + Math.pow(lat - oldLat, 2)
      );

      if (distance > 0.00001) {
        data.startLon = oldLon;
        data.startLat = oldLat;
        data.targetLon = lon;
        data.targetLat = lat;
        data.animationStartTime = performance.now();
      }

      this._debugMaybeLogRotation(vehicleId, bearing, targetYawDeg, data.yawDegSmoothed);

      // Create or update route badge
      if (routeNumber) {
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
            offset: [0, -15]
          })
            .setLngLat([data.currentLon, data.currentLat])
            .addTo(this.map);

          this.routeBadges.set(vehicleId, badge);
        }
      }

      // Start animation loop if not already running
      if (!this._animationFrameId) {
        this.startAnimationLoop();
      }

    } catch (e) {
      console.error("❌ Error drawing 3D bus model:", e);
    }
  }

  startAnimationLoop() {
    const animate = () => {
      const now = performance.now();
      const modelSource = this.map.getSource('buses-3d-source');
      
      if (!modelSource) {
        this._animationFrameId = null;
        return;
      }

      const currentModels = modelSource._data?.models || {};
      const updatedModels = {};
      let hasActiveAnimations = false;

      this.busData.forEach((data, vehicleId) => {
        // Animate position if needed
        if (data.animationStartTime && data.startLon && data.startLat && data.targetLon && data.targetLat) {
          const elapsed = now - data.animationStartTime;
          const progress = Math.min(elapsed / data.animationDuration, 1);
          const eased = progress * (2 - progress); // ease-out

          data.currentLon = data.startLon + (data.targetLon - data.startLon) * eased;
          data.currentLat = data.startLat + (data.targetLat - data.startLat) * eased;

          // Update badge position
          const badge = this.routeBadges.get(vehicleId);
          if (badge) {
            badge.setLngLat([data.currentLon, data.currentLat]);
          }

          if (progress >= 1) {
            data.animationStartTime = null;
          } else {
            hasActiveAnimations = true;
          }
        }

        // Always update model position (even when not animating)
        updatedModels[vehicleId] = {
          uri: this.GLB_URL,
          position: [data.currentLon, data.currentLat],
          orientation: [0, 0, data.yawDegSmoothed || 0]
        };
      });

      // Update all models at once
      if (Object.keys(updatedModels).length > 0) {
        modelSource.setModels(updatedModels);
      }

      // Continue loop if there are buses (always run when buses exist)
      if (this.busData.size > 0) {
        this._animationFrameId = requestAnimationFrame(animate);
      } else {
        this._animationFrameId = null;
      }
    };

    this._animationFrameId = requestAnimationFrame(animate);
  }

  draw2DBusFallback(vehicleId, lon, lat, bearing, color, routeNumber) {
    this._debugMaybeLogPath("⚠️ FALLBACK path (2D markers)");

    let marker = this.busMarkers.get(vehicleId);

    if (marker) {
      // Animate to new position
      this.animateBusTo(vehicleId, lon, lat, 2000);

      const el = marker.getElement();
      if (el) {
        const model = el.querySelector('.bus-3d-container');
        if (model) {
          model.style.transform = `rotateZ(${bearing}deg)`;
        }
      }
    } else {
      const el = this._create2DBusElement(bearing, color, routeNumber);

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

  _create2DBusElement(bearing, color, routeNumber) {
    const el = document.createElement('div');
    el.className = 'bus-marker-3d';

    el.innerHTML = `
      <div class="bus-3d-container" style="transform: rotateZ(${bearing}deg);">
        <div class="bus-3d-model" style="background: ${color};">
          <div class="bus-3d-body">
            <div class="bus-3d-front"></div>
            <div class="bus-3d-top"></div>
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

    // Remove 2D fallback markers
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

    // Remove 3D models from model source
    const modelSource = this.map.getSource('buses-3d-source');
    if (modelSource) {
      const currentModels = modelSource._data?.models || {};
      const updatedModels = {};
      
      Object.keys(currentModels).forEach(id => {
        if (activeVehicleIds.has(id)) {
          updatedModels[id] = currentModels[id];
        }
      });
      
      modelSource.setModels(updatedModels);
    }

    // Remove badges
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

    // Clean bus data
    this.busData.forEach((data, id) => {
      if (!activeVehicleIds.has(id)) this.busData.delete(id);
    });
  }

  clearAll() {
    // Clear 2D markers
    this.busMarkers.forEach(marker => {
      try { if (marker && marker.remove) marker.remove(); } catch (e) {}
    });
    this.busMarkers.clear();

    // Clear 3D models
    const modelSource = this.map.getSource('buses-3d-source');
    if (modelSource) {
      modelSource.setModels({});
    }

    // Clear badges
    this.routeBadges.forEach(badge => {
      try { if (badge && badge.remove) badge.remove(); } catch (e) {}
    });
    this.routeBadges.clear();

    // Clear data
    this.busData.clear();
    
    // Stop animation loop
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    
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
}