// modules/map/bus3DModelManager.js
// מנהל מודלים תלת-מימדיים לאוטובוסים - גרסת Three.js + Mapbox

class Bus3DModelManager {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.busInstances = new Map(); // vehicleId -> { model, data }
    this.masterModel = null;
    this.isLoaded = false;
    this.customLayer = null;
    
    // Model configuration
    this.config = {
      glbUrl: "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb",
      modelScale: 45,
      altitudeMeters: 0,
      
      // Rotation tuning
      yawOffsetDeg: -51.75,
      baseRotXDeg: 88.25,
      baseRotYDeg: 0,
      baseRotZDeg: 0,
      
      // Position offset
      offsetEastM: 0,
      offsetNorthM: 0,
      offsetUpM: 0,
      scaleMul: 1,
      
      // Animation
      animationDuration: 2000, // ms
      smoothingFactor: 0.15
    };
    
    // Quaternions for rotation
    this.qBase = new THREE.Quaternion();
    this.qYaw = new THREE.Quaternion();
    this.qOut = new THREE.Quaternion();
    this.axisZ = new THREE.Vector3(0, 0, 1);
    
    this.initBaseQuaternion();
    
    console.log("🚌 Bus3DModelManager initialized");
  }

  initBaseQuaternion() {
    const deg2rad = Math.PI / 180;
    const euler = new THREE.Euler(
      this.config.baseRotXDeg * deg2rad,
      this.config.baseRotYDeg * deg2rad,
      this.config.baseRotZDeg * deg2rad,
      "XYZ"
    );
    this.qBase.setFromEuler(euler);
  }

  async init() {
    if (!this.map) {
      console.error("❌ Map not initialized");
      return false;
    }

    try {
      console.log("🔧 Initializing Three.js layer...");
      
      // Check if Three.js is available
      if (typeof THREE === 'undefined') {
        console.error("❌ Three.js not loaded!");
        return false;
      }

      // Create custom layer for Mapbox
      this.customLayer = {
        id: 'three-buses',
        type: 'custom',
        renderingMode: '3d',
        
        onAdd: (map, gl) => {
          this.scene = new THREE.Scene();
          this.camera = new THREE.Camera();
          
          // Use Mapbox canvas
          const canvas = map.getCanvas();
          this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            context: gl,
            antialias: true
          });
          this.renderer.autoClear = false;

          // Lighting
          const ambient = new THREE.AmbientLight(0xffffff, 0.9);
          this.scene.add(ambient);
          
          const directional = new THREE.DirectionalLight(0xffffff, 0.9);
          directional.position.set(10, -10, 20);
          this.scene.add(directional);

          // Load GLB model
          this.loadModel();
          
          console.log("✅ Three.js scene created");
        },

        render: (gl, matrix) => {
          if (!this.scene || !this.camera || !this.renderer) return;

          // Update camera
          this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

          // Update all bus instances
          this.updateBusPositions();

          // Render
          this.renderer.state.reset();
          this.renderer.render(this.scene, this.camera);
          this.map.triggerRepaint();
        }
      };

      // Add layer to map
      if (this.map.isStyleLoaded()) {
        this.map.addLayer(this.customLayer);
      } else {
        this.map.once('load', () => {
          this.map.addLayer(this.customLayer);
        });
      }

      console.log("✅ Three.js layer added to map");
      return true;

    } catch (e) {
      console.error("❌ Error initializing 3D model manager:", e);
      return false;
    }
  }

  loadModel() {
    if (typeof THREE.GLTFLoader === 'undefined') {
      console.error("❌ GLTFLoader not available");
      return;
    }

    console.log("📦 Loading GLB model...");
    
    const loader = new THREE.GLTFLoader();
    
    loader.load(
      this.config.glbUrl,
      (gltf) => {
        this.masterModel = gltf.scene;
        this.isLoaded = true;
        console.log("✅ GLB model loaded successfully");
        
        // Create instances for existing buses
        this.createPendingInstances();
      },
      (progress) => {
        const percent = (progress.loaded / progress.total * 100).toFixed(0);
        console.log(`📦 Loading model: ${percent}%`);
      },
      (error) => {
        console.error("❌ Error loading GLB:", error);
      }
    );
  }

  createPendingInstances() {
    // Create 3D instances for buses that were added before model loaded
    this.busInstances.forEach((instance, vehicleId) => {
      if (!instance.model && this.masterModel) {
        this.createBusInstance(vehicleId, instance.data);
      }
    });
  }

  addOrUpdateBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    if (!this.scene) return;

    const data = { lon, lat, bearing, color, routeNumber };
    
    let instance = this.busInstances.get(vehicleId);
    
    if (instance) {
      // Update existing
      instance.targetLon = lon;
      instance.targetLat = lat;
      instance.targetBearing = bearing;
      instance.data = data;
    } else {
      // Create new
      instance = {
        model: null,
        data: data,
        currentLon: lon,
        currentLat: lat,
        targetLon: lon,
        targetLat: lat,
        currentBearing: bearing,
        targetBearing: bearing,
        yawDegSmoothed: null
      };
      
      this.busInstances.set(vehicleId, instance);
      
      // Create 3D model if loaded
      if (this.isLoaded && this.masterModel) {
        this.createBusInstance(vehicleId, data);
      }
    }
  }

  createBusInstance(vehicleId, data) {
    if (!this.masterModel || !this.scene) return;

    try {
      // Clone model
      const model = this.masterModel.clone();
      
      // Apply color
      model.traverse((child) => {
        if (child.isMesh) {
          // Apply color tint
          if (data.color) {
            const color = new THREE.Color(data.color);
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  if (mat.color) mat.color = color;
                });
              } else {
                if (child.material.color) {
                  child.material.color = color;
                }
              }
            }
          }
        }
      });

      this.scene.add(model);
      
      const instance = this.busInstances.get(vehicleId);
      if (instance) {
        instance.model = model;
      }
      
      console.log(`✅ 3D model created for bus ${vehicleId}`);
    } catch (e) {
      console.error(`❌ Error creating bus instance ${vehicleId}:`, e);
    }
  }

  updateBusPositions() {
    if (!this.map) return;

    this.busInstances.forEach((instance, vehicleId) => {
      if (!instance.model) return;

      try {
        // Smooth interpolation
        const smoothing = this.config.smoothingFactor;
        instance.currentLon += (instance.targetLon - instance.currentLon) * smoothing;
        instance.currentLat += (instance.targetLat - instance.currentLat) * smoothing;

        // Convert to Mercator coordinates
        const mc = mapboxgl.MercatorCoordinate.fromLngLat(
          { lng: instance.currentLon, lat: instance.currentLat },
          this.config.altitudeMeters
        );
        const s = mc.meterInMercatorCoordinateUnits();

        // Set position
        instance.model.position.set(
          mc.x + this.config.offsetEastM * s,
          mc.y - this.config.offsetNorthM * s,
          mc.z + this.config.offsetUpM * s
        );

        // Set scale
        const finalScale = this.config.modelScale * s * this.config.scaleMul;
        instance.model.scale.set(finalScale, finalScale, finalScale);

        // Set rotation (quaternion-based)
        let targetYawDeg = instance.targetBearing + this.config.yawOffsetDeg;
        
        if (instance.yawDegSmoothed == null) {
          instance.yawDegSmoothed = targetYawDeg;
        }
        
        // Unwrap to prevent 359->0 jumps
        instance.yawDegSmoothed = this.unwrapToNearest(
          instance.yawDegSmoothed, 
          targetYawDeg
        );

        const deg2rad = Math.PI / 180;
        const yawRad = instance.yawDegSmoothed * deg2rad;

        // Compose quaternion
        this.qYaw.setFromAxisAngle(this.axisZ, -yawRad);
        this.qOut.copy(this.qYaw).multiply(this.qBase);
        instance.model.quaternion.copy(this.qOut);

      } catch (e) {
        console.error(`❌ Error updating bus ${vehicleId}:`, e);
      }
    });
  }

  unwrapToNearest(prevDeg, targetDeg) {
    let delta = this.wrap180(targetDeg - prevDeg);
    return prevDeg + delta;
  }

  wrap180(deg) {
    let d = ((deg + 180) % 360 + 360) % 360 - 180;
    return d;
  }

  removeBus(vehicleId) {
    const instance = this.busInstances.get(vehicleId);
    if (instance && instance.model) {
      this.scene.remove(instance.model);
      
      // Cleanup geometry and materials
      instance.model.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }
    this.busInstances.delete(vehicleId);
  }

  pruneMarkers(activeVehicleIds) {
    if (!activeVehicleIds || !(activeVehicleIds instanceof Set)) return;

    const toRemove = [];
    this.busInstances.forEach((instance, id) => {
      if (!activeVehicleIds.has(id)) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => this.removeBus(id));
    
    if (toRemove.length > 0) {
      console.log(`🗑️ Removed ${toRemove.length} inactive buses`);
    }
  }

  clearAll() {
    this.busInstances.forEach((instance, id) => {
      this.removeBus(id);
    });
    this.busInstances.clear();
    console.log("🗑️ All 3D buses cleared");
  }

  setConfig(newConfig) {
    Object.assign(this.config, newConfig);
    this.initBaseQuaternion();
    console.log("⚙️ 3D model config updated");
  }

  getConfig() {
    return { ...this.config };
  }

  isModelLoaded() {
    return this.isLoaded;
  }
}
