// modules/map/busMarkers.js
// אחראי על ציור אוטובוסים תלת-מימדיים על המפה - Mapbox + Three.js GLB version

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map();
    this.glbModel = null;
    this.modelLoaded = false;
    
    // Load Three.js and GLTFLoader
    this.loadThreeJS();
    
    console.log("🚌 BusMarkers initialized (Three.js GLB)");
  }

  loadThreeJS() {
    // Check if Three.js is already loaded
    if (typeof THREE !== 'undefined') {
      this.initGLTFLoader();
      return;
    }

    // Load Three.js
    const threeScript = document.createElement('script');
    threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    threeScript.onload = () => {
      console.log('✅ Three.js loaded');
      this.initGLTFLoader();
    };
    document.head.appendChild(threeScript);
  }

  initGLTFLoader() {
    // Load GLTFLoader
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
    
    // Load the GLB model from GitHub
    loader.load(
      'https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb',
      (gltf) => {
        this.glbModel = gltf.scene;
        this.modelLoaded = true;
        console.log('✅ Bus GLB model loaded successfully!');
      },
      (xhr) => {
        console.log(`Loading bus model: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`);
      },
      (error) => {
        console.error('❌ Error loading bus model:', error);
      }
    );
  }

  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map) {
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
          
          this.draw3DBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
        }
      } catch (e) {
        console.error("❌ Error drawing bus:", e);
      }
    });
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
  }

  draw3DBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    try {
      let marker = this.busMarkers.get(vehicleId);
      
      if (marker) {
        // Animate to new position
        this.animateBusTo(vehicleId, lon, lat, 2000);
        
        // Update rotation
        const el = marker.getElement();
        if (el) {
          const canvas = el.querySelector('canvas');
          if (canvas && canvas.threeScene) {
            // Update the Three.js scene rotation
            canvas.threeScene.rotation.z = bearing * Math.PI / 180;
          }
        }
      } else {
        // Create new 3D marker
        const el = this._create3DBusElement(bearing, color, routeNumber);
        
        marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
          rotationAlignment: 'map',
          pitchAlignment: 'viewport'
        })
          .setLngLat([lon, lat])
          .addTo(this.map);
        
        this.busMarkers.set(vehicleId, marker);
      }
    } catch (e) {
      console.error(`❌ Error drawing 3D bus ${vehicleId}:`, e);
    }
  }

  _create3DBusElement(bearing, color, routeNumber) {
    const el = document.createElement('div');
    el.className = 'bus-marker-3d';
    el.style.width = '80px';
    el.style.height = '80px';
    
    if (this.modelLoaded && this.glbModel) {
      // Create Three.js canvas for this bus
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      canvas.style.width = '80px';
      canvas.style.height = '80px';
      
      // Setup Three.js scene
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        alpha: true,
        antialias: true 
      });
      
      renderer.setSize(160, 160);
      renderer.setClearColor(0x000000, 0);
      
      // Clone the model
      const busModel = this.glbModel.clone();
      
      // Apply color to model
      busModel.traverse((child) => {
        if (child.isMesh) {
          // Parse color
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
      
      // Rotate to match bearing
      busModel.rotation.z = bearing * Math.PI / 180;
      
      // Add to scene
      scene.add(busModel);
      canvas.threeScene = busModel; // Store reference for updates
      
      // Position camera
      camera.position.set(0, -3, 2);
      camera.lookAt(0, 0, 0);
      
      // Add lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 5, 5);
      scene.add(directionalLight);
      
      // Render
      renderer.render(scene, camera);
      
      // Add route badge
      const badge = document.createElement('div');
      badge.className = 'route-badge-3d';
      badge.style.position = 'absolute';
      badge.style.top = '-15px';
      badge.style.left = '50%';
      badge.style.transform = 'translateX(-50%)';
      badge.style.padding = '3px 8px';
      badge.style.background = 'white';
      badge.style.border = `2px solid ${color}`;
      badge.style.borderRadius = '10px';
      badge.style.fontWeight = 'bold';
      badge.style.fontSize = '11px';
      badge.style.color = color;
      badge.textContent = routeNumber || '';
      
      el.appendChild(canvas);
      if (routeNumber) {
        el.appendChild(badge);
      }
      
      // Animation loop for smooth rendering
      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();
      
    } else {
      // Fallback to CSS-based bus while loading
      el.innerHTML = `
        <div class="bus-3d-container" style="transform: rotateZ(${bearing}deg);">
          <div class="bus-3d-model" style="background: ${color};">
            <div class="bus-3d-body">
              <div class="bus-3d-front"></div>
            </div>
            <div class="bus-3d-wheels">
              <div class="wheel"></div>
              <div class="wheel"></div>
            </div>
          </div>
          ${routeNumber ? `
            <div class="route-badge-3d" style="background: white; color: ${color}; border-color: ${color};">
              ${routeNumber}
            </div>
          ` : ''}
        </div>
      `;
    }
    
    return el;
  }

  clearAll() {
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
}