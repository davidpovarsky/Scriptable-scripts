// modules/map/busMarkers.js
// אחראי על ציור אוטובוסים תלת-מימדיים על המפה - Mapbox Custom Layer + Three.js
// גרסה מתוקנת: רנדרר משותף אחד לכל האוטובוסים!

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map();
    this.glbModel = null;
    this.modelLoaded = false;
    this.customLayer = null;
    this.scene = null;
    this.camera = null;
    
    // Load Three.js and setup
    this.loadThreeJS();
    
    console.log("🚌 BusMarkers initialized (Mapbox Custom Layer)");
  }

  loadThreeJS() {
    if (typeof THREE !== 'undefined') {
      this.initGLTFLoader();
      return;
    }

    const threeScript = document.createElement('script');
    threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    threeScript.onload = () => {
      console.log('✅ Three.js loaded');
      this.initGLTFLoader();
    };
    document.head.appendChild(threeScript);
  }

  initGLTFLoader() {
    const loaderScript = document.createElement('script');
    loaderScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
    loaderScript.onload = () => {
      console.log('✅ GLTFLoader loaded');
      this.loadBusModel();
    };
    document.head.appendChild(loaderScript);
  }

  loadBusModel() {
    const loader = new THREE.GLTFLoader();
    
    loader.load(
      'https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb',
      (gltf) => {
        this.glbModel = gltf.scene;
        this.modelLoaded = true;
        console.log('✅ Bus GLB model loaded successfully!');
        
        // Setup custom layer once model is loaded
        this.setupCustomLayer();
      },
      (xhr) => {
        console.log(`Loading bus model: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`);
      },
      (error) => {
        console.error('❌ Error loading bus model:', error);
      }
    );
  }

  setupCustomLayer() {
    if (!this.map || !this.modelLoaded) return;

    const modelTransform = {
      translateX: 0,
      translateY: 0,
      translateZ: 0,
      rotateX: Math.PI / 2,
      rotateY: 0,
      rotateZ: 0,
      scale: 1
    };

    const self = this;

    this.customLayer = {
      id: '3d-buses',
      type: 'custom',
      renderingMode: '3d',
      
      onAdd: function(map, gl) {
        // Create Three.js scene
        self.scene = new THREE.Scene();
        
        // Camera
        self.camera = new THREE.Camera();
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        self.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(10, 10, 10);
        self.scene.add(directionalLight);
        
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-10, -10, 5);
        self.scene.add(directionalLight2);
        
        // Renderer
        self.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true
        });
        
        self.renderer.autoClear = false;
        
        console.log('✅ Custom 3D layer initialized');
      },
      
      render: function(gl, matrix) {
        if (!self.camera || !self.scene || !self.renderer) return;
        
        const rotationX = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(1, 0, 0),
          modelTransform.rotateX
        );
        const rotationY = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 1, 0),
          modelTransform.rotateY
        );
        const rotationZ = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 0, 1),
          modelTransform.rotateZ
        );

        const m = new THREE.Matrix4().fromArray(matrix);
        const l = new THREE.Matrix4()
          .makeTranslation(
            modelTransform.translateX,
            modelTransform.translateY,
            modelTransform.translateZ
          )
          .scale(
            new THREE.Vector3(
              modelTransform.scale,
              -modelTransform.scale,
              modelTransform.scale
            )
          )
          .multiply(rotationX)
          .multiply(rotationY)
          .multiply(rotationZ);

        self.camera.projectionMatrix = m.multiply(l);
        self.renderer.resetState();
        self.renderer.render(self.scene, self.camera);
        self.map.triggerRepaint();
      }
    };

    // Add layer to map
    if (!this.map.getLayer('3d-buses')) {
      this.map.addLayer(this.customLayer);
      console.log('✅ 3D buses layer added to map');
    }
  }

  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map || !this.modelLoaded || !this.scene) {
      return;
    }

    if (!Array.isArray(vehicles)) {
      return;
    }

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
          const bearing = v.bearing || 0;
          
          this.updateOrCreate3DBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
        }
      } catch (e) {
        console.error("❌ Error drawing bus:", e);
      }
    });
  }

  updateOrCreate3DBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    let busObject = this.busMarkers.get(vehicleId);
    
    // Convert lat/lon to Mercator coordinates
    const mercatorCoord = mapboxgl.MercatorCoordinate.fromLngLat([lon, lat], 0);
    
    // Calculate proper scale based on map zoom
    const metersPerPixel = mercatorCoord.meterInMercatorCoordinateUnits();
    const scale = metersPerPixel * 20; // Adjust multiplier for visibility
    
    if (busObject) {
      // Update existing bus position
      busObject.position.set(
        mercatorCoord.x,
        mercatorCoord.y,
        mercatorCoord.z
      );
      
      // Update rotation (bearing to radians, with correction for Mapbox coordinate system)
      busObject.rotation.z = (bearing + 90) * Math.PI / 180;
      
      // Update scale
      busObject.scale.set(scale, scale, scale);
      
    } else {
      // Create new bus
      const busModel = this.glbModel.clone();
      
      // Apply color
      busModel.traverse((child) => {
        if (child.isMesh) {
          let r, g, b;
          if (color.startsWith('#')) {
            const hex = color.substring(1);
            r = parseInt(hex.substring(0, 2), 16) / 255;
            g = parseInt(hex.substring(2, 4), 16) / 255;
            b = parseInt(hex.substring(4, 6), 16) / 255;
          } else if (color.startsWith('rgb')) {
            const matches = color.match(/\d+/g);
            if (matches && matches.length >= 3) {
              r = parseInt(matches[0]) / 255;
              g = parseInt(matches[1]) / 255;
              b = parseInt(matches[2]) / 255;
            }
          }
          
          if (r !== undefined) {
            child.material = child.material.clone();
            child.material.color.setRGB(r, g, b);
          }
        }
      });
      
      // Position
      busModel.position.set(
        mercatorCoord.x,
        mercatorCoord.y,
        mercatorCoord.z + 0.00001 // Slight elevation to ensure visibility
      );
      
      // Rotation (bearing to radians, with correction)
      busModel.rotation.z = (bearing + 90) * Math.PI / 180;
      
      // Scale
      busModel.scale.set(scale, scale, scale);
      
      // Add to scene
      this.scene.add(busModel);
      this.busMarkers.set(vehicleId, busModel);
      
      console.log(`✅ Bus ${vehicleId} added at [${lon}, ${lat}] scale=${scale.toFixed(6)}`);
    }
  }

  pruneMarkers(activeVehicleIds) {
    if (!activeVehicleIds || !(activeVehicleIds instanceof Set)) return;
    if (!this.scene) return;

    this.busMarkers.forEach((busObject, id) => {
      if (!activeVehicleIds.has(id)) {
        try {
          this.scene.remove(busObject);
          this.busMarkers.delete(id);
        } catch (e) {
          console.error("❌ Error removing bus:", e);
        }
      }
    });
  }

  clearAll() {
    if (this.scene) {
      this.busMarkers.forEach((busObject) => {
        this.scene.remove(busObject);
      });
    }
    this.busMarkers.clear();
    console.log("🗑️ All buses cleared");
  }

  animateBusTo(vehicleId, newLon, newLat, duration = 2000) {
    const busObject = this.busMarkers.get(vehicleId);
    if (!busObject) return;

    const newMercator = mapboxgl.MercatorCoordinate.fromLngLat([newLon, newLat], 0);
    
    const startPos = {
      x: busObject.position.x,
      y: busObject.position.y,
      z: busObject.position.z
    };
    
    const endPos = {
      x: newMercator.x,
      y: newMercator.y,
      z: newMercator.z
    };
    
    let startTime = null;
    
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      const eased = progress * (2 - progress);
      
      busObject.position.x = startPos.x + (endPos.x - startPos.x) * eased;
      busObject.position.y = startPos.y + (endPos.y - startPos.y) * eased;
      busObject.position.z = startPos.z + (endPos.z - startPos.z) * eased;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }
}