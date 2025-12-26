// modules/map/busMarkers.js
// אחראי על ציור אוטובוסים תלת-מימדיים על המפה - Canvas Markers + Three.js
// גרסה פשוטה: כל אוטובוס = Canvas עם התמונה שלו מה-renderer המשותף

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map();
    this.glbModel = null;
    this.modelLoaded = false;
    
    // Shared Three.js components for rendering
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.pendingBuses = [];
    
    // Load Three.js and setup
    this.loadThreeJS();
    
    console.log("🚌 BusMarkers initialized (Canvas Markers + Three.js)");
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
      this.setupRenderer();
      this.loadBusModel();
    };
    document.head.appendChild(loaderScript);
  }

  setupRenderer() {
    // Create offscreen canvas for rendering
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true // Important for capturing frames
    });
    
    this.renderer.setSize(256, 256);
    this.renderer.setClearColor(0x000000, 0);
    
    // Setup scene
    this.scene = new THREE.Scene();
    
    // Setup camera
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(0, -5, 3);
    this.camera.lookAt(0, 0, 0);
    
    // Setup lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(5, -5, 5);
    this.scene.add(directionalLight);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, 5, 3);
    this.scene.add(directionalLight2);
    
    console.log('✅ Three.js renderer initialized');
  }

  loadBusModel() {
    const loader = new THREE.GLTFLoader();
    
    loader.load(
      'https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb',
      (gltf) => {
        this.glbModel = gltf.scene;
        this.modelLoaded = true;
        console.log('✅ Bus GLB model loaded!');
        
        // Process pending buses
        if (this.pendingBuses.length > 0) {
          console.log(`🔄 Processing ${this.pendingBuses.length} pending buses...`);
          this.pendingBuses.forEach(bus => {
            this.draw3DBus(
              bus.vehicleId,
              bus.lon,
              bus.lat,
              bus.bearing,
              bus.color,
              bus.routeNumber
            );
          });
          this.pendingBuses = [];
        }
      },
      (xhr) => {
        console.log(`Loading: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`);
      },
      (error) => {
        console.error('❌ Error loading model:', error);
      }
    );
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
          const bearing = v.bearing || 0;
          
          if (!this.modelLoaded) {
            this.pendingBuses.push({
              vehicleId,
              lon,
              lat,
              bearing,
              color,
              routeNumber: v.routeNumber
            });
          } else {
            this.draw3DBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
          }
        }
      } catch (e) {
        console.error("❌ Error:", e);
      }
    });
  }

  draw3DBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    let marker = this.busMarkers.get(vehicleId);
    
    if (marker) {
      // Update existing marker
      this.animateBusTo(vehicleId, lon, lat, 2000);
      
      // Update rotation if needed
      const el = marker.getElement();
      if (el && el._busData) {
        el._busData.bearing = bearing;
        this.updateBusImage(el, color, bearing, routeNumber);
      }
    } else {
      // Create new marker
      const el = this.createBusElement(color, bearing, routeNumber);
      
      marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
        rotationAlignment: 'map',
        pitchAlignment: 'viewport'
      })
        .setLngLat([lon, lat])
        .addTo(this.map);
      
      this.busMarkers.set(vehicleId, marker);
      console.log(`✅ Bus ${vehicleId} added`);
    }
  }

  createBusElement(color, bearing, routeNumber) {
    const container = document.createElement('div');
    container.className = 'bus-3d-marker';
    container.style.width = '64px';
    container.style.height = '64px';
    container.style.position = 'relative';
    
    // Create canvas for the 3D bus
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    canvas.style.width = '64px';
    canvas.style.height = '64px';
    
    // Store data for updates
    container._busData = {
      canvas: canvas,
      color: color,
      bearing: bearing,
      routeNumber: routeNumber
    };
    
    // Render the bus
    this.renderBusToCanvas(canvas, color, bearing);
    
    container.appendChild(canvas);
    
    // Add route badge
    if (routeNumber) {
      const badge = document.createElement('div');
      badge.className = 'route-badge-3d';
      badge.style.cssText = `
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        padding: 2px 6px;
        background: white;
        border: 2px solid ${color};
        border-radius: 8px;
        font-weight: bold;
        font-size: 10px;
        color: ${color};
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        pointer-events: none;
      `;
      badge.textContent = routeNumber;
      container.appendChild(badge);
    }
    
    return container;
  }

  renderBusToCanvas(targetCanvas, color, bearing) {
    if (!this.glbModel || !this.renderer || !this.scene) return;
    
    // Clone and prepare the model
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
    
    // Set rotation
    busModel.rotation.z = bearing * Math.PI / 180;
    
    // Add to scene temporarily
    this.scene.add(busModel);
    
    // Render
    this.renderer.render(this.scene, this.camera);
    
    // Copy to target canvas
    const ctx = targetCanvas.getContext('2d');
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.drawImage(this.renderer.domElement, 0, 0, targetCanvas.width, targetCanvas.height);
    
    // Remove from scene
    this.scene.remove(busModel);
  }

  updateBusImage(element, color, bearing, routeNumber) {
    if (!element._busData) return;
    
    const canvas = element._busData.canvas;
    this.renderBusToCanvas(canvas, color, bearing);
  }

  pruneMarkers(activeVehicleIds) {
    if (!activeVehicleIds || !(activeVehicleIds instanceof Set)) return;

    this.busMarkers.forEach((marker, id) => {
      if (!activeVehicleIds.has(id)) {
        try {
          marker.remove();
          this.busMarkers.delete(id);
        } catch (e) {
          console.error("❌ Error removing:", e);
        }
      }
    });
  }

  clearAll() {
    this.busMarkers.forEach(marker => {
      try {
        marker.remove();
      } catch (e) {}
    });
    this.busMarkers.clear();
    console.log("🗑️ Cleared");
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
      console.error("❌ Animation error:", e);
    }
  }
}