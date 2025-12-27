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
    this.MODEL_YAW_OFFSET_DEG = -51.75;
    this.MODEL_BASE_ROT_X_DEG = 88.25;
    this.MODEL_BASE_ROT_Y_DEG = 0;
    this.MODEL_BASE_ROT_Z_DEG = 0;
    this.OFFSET_EAST_M = 0;
    this.OFFSET_NORTH_M = 0;
    this.OFFSET_UP_M = 0;
    this.SCALE_MUL = 1;
    this.MODEL_SCALE = 45;
    this.MODEL_ALT_METERS = 0;
    this.FLIP_X_180 = false;
    
    // Three.js components
    this.threeInitialized = false;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.glbModelTemplate = null; // Template model
    this.busModels = new Map(); // Individual bus models
    
    // Quaternions
    this.qBase = null;
    this.qYaw = null;
    this.qOut = null;
    this.axisZ = null;
    
    // Bus data for smooth animation
    this.busData = new Map();
    
    console.log("🚌 BusMarkers initialized (GLB + Three.js)");
    
    // Check if THREE is available and initialize
    this.checkAndInitThree();
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
        // Initialize Three.js scene
        self.scene = new THREE.Scene();
        self.camera = new THREE.Camera();
        self.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true
        });
        self.renderer.autoClear = false;
        
        // Add lights
        self.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const dir = new THREE.DirectionalLight(0xffffff, 0.9);
        dir.position.set(10, -10, 20);
        self.scene.add(dir);
        
        // Initialize quaternions
        self.qBase = new THREE.Quaternion();
        self.qYaw = new THREE.Quaternion();
        self.qOut = new THREE.Quaternion();
        self.axisZ = new THREE.Vector3(0, 0, 1);
        self.updateBaseQuaternion();
        
        // Load GLB template model
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
        
        // Update camera matrix
        self.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
        
        // Render scene
        self.renderer.state.reset();
        self.renderer.render(self.scene, self.camera);
        self.map.triggerRepaint();
      }
    };
    
    // Add the layer to map immediately
    // The onAdd callback will be called automatically when the layer is added
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
      
      // Fallback: wait for styledata event
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
          let bearing = v.bearing || 0;
          
          // חישוב bearing מהמסלול אם אין
          if (!v.bearing && shapeLatLngs.length > 1 && v.positionOnLine) {
            bearing = this.calculateBearing(shapeLatLngs, v.positionOnLine);
          }
          
          // Store/update bus data
          const existingData = this.busData.get(vehicleId);
          this.busData.set(vehicleId, {
            lon, lat, bearing, color,
            routeNumber: v.routeNumber,
            yawDegSmoothed: existingData?.yawDegSmoothed || null
          });
          
          // Draw with GLB if available, otherwise fallback
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
    if (!this.scene || !this.glbModelTemplate) return;
    
    let busModel = this.busModels.get(vehicleId);
    
    // Create new model if doesn't exist
    if (!busModel) {
      busModel = this.glbModelTemplate.clone();
      this.scene.add(busModel);
      this.busModels.set(vehicleId, busModel);
      console.log(`🚌 Created GLB model for bus ${vehicleId}`);
    }
    
    // Get bus data for smoothing
    const data = this.busData.get(vehicleId);
    if (!data) return;
    
    // Convert to Mercator coordinates
    const mc = mapboxgl.MercatorCoordinate.fromLngLat(
      { lng: lon, lat: lat },
      this.MODEL_ALT_METERS
    );
    const s = mc.meterInMercatorCoordinateUnits();
    
    // Position
    busModel.position.set(
      mc.x + this.OFFSET_EAST_M * s,
      mc.y - this.OFFSET_NORTH_M * s,
      mc.z + this.OFFSET_UP_M * s
    );
    
    // Scale
    const finalScale = this.MODEL_SCALE * s * this.SCALE_MUL;
    busModel.scale.set(finalScale, finalScale, finalScale);
    
    // Rotation with quaternion (smooth, no flips)
    let targetYawDeg = bearing + this.MODEL_YAW_OFFSET_DEG;
    
    if (data.yawDegSmoothed == null) {
      data.yawDegSmoothed = targetYawDeg;
    } else {
      // Unwrap to prevent 359->0 jumps
      data.yawDegSmoothed = this.unwrapToNearest(data.yawDegSmoothed, targetYawDeg);
    }
    
    const deg2rad = Math.PI / 180;
    const yawRad = data.yawDegSmoothed * deg2rad;
    
    // Quaternion composition: qOut = qYaw * qBase
    this.qYaw.setFromAxisAngle(this.axisZ, -yawRad);
    this.qOut.copy(this.qYaw).multiply(this.qBase);
    busModel.quaternion.copy(this.qOut);
    
    // Optional: Apply color (if model supports it)
    // You can traverse the model and change material colors here if needed
  }

  draw3DBusFallback(vehicleId, lon, lat, bearing, color, routeNumber) {
    // Fallback to 2D markers if GLB not loaded
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
    let d = ((deg + 180) % 360 + 360) % 360 - 180;
    return d;
  }

  unwrapToNearest(prevDeg, targetDeg) {
    let delta = this.wrap180(targetDeg - prevDeg);
    return prevDeg + delta;
  }

  pruneMarkers(activeVehicleIds) {
    if (!activeVehicleIds || !(activeVehicleIds instanceof Set)) return;

    // Remove 2D markers
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
    
    // Remove 3D models
    this.busModels.forEach((model, id) => {
      if (!activeVehicleIds.has(id)) {
        try {
          if (this.scene) {
            this.scene.remove(model);
          }
          this.busModels.delete(id);
        } catch (e) {
          console.error("❌ Error removing 3D model:", e);
        }
      }
    });
    
    // Clean bus data
    this.busData.forEach((data, id) => {
      if (!activeVehicleIds.has(id)) {
        this.busData.delete(id);
      }
    });
  }

  clearAll() {
    // Clear 2D markers
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
    this.busModels.forEach(model => {
      try {
        if (this.scene) {
          this.scene.remove(model);
        }
      } catch (e) {
        console.error("❌ Error clearing 3D model:", e);
      }
    });
    this.busModels.clear();
    
    this.busData.clear();
    console.log("🗑️ All buses cleared");
  }

  animateBusTo(vehicleId, newLon, newLat, duration = 2000) {
    const marker = this.busMarkers.get(vehicleId);
    if (!marker) return;

    try {
      const start = marker.getLngLat();
      const end = [newLon, newLat];
      
      if (Math.abs(start.lng - end[0]) < 0.00001 && Math.abs(start.lat - end[1]) < 0.00001) {
        return;
      }
      
      let startTime = null;
      
      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
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

  toggleFlip() {
    this.FLIP_X_180 = !this.FLIP_X_180;
    try {
      localStorage.setItem("bus_flip_x_180_v2", this.FLIP_X_180 ? "1" : "0");
    } catch(e){}
    this.updateBaseQuaternion();
    console.log(`🔄 Flip mode: ${this.FLIP_X_180 ? 'ON' : 'OFF'}`);
  }
}