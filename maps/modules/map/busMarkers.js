// modules/map/busMarkers.js
// אחראי על ציור אוטובוסים תלת-מימדיים על המפה - Canvas Markers + Three.js

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map();
    this.glbModel = null;
    this.modelLoaded = false;
    
    // רכיבי Three.js משותפים לרינדור
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.pendingBuses = [];
    
    // טעינת Three.js
    this.loadThreeJS();
    
    console.log("🚌 BusMarkers initialized (Fixed Camera Version)");
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
    // יצירת Canvas נסתר לרינדור
    // הקטנתי ל-128 לביצועים, אבל האיכות תהיה טובה כי האייקון במפה קטן
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: canvas,
      alpha: true, // חובה לרקע שקוף
      antialias: true,
      preserveDrawingBuffer: true
    });
    
    this.renderer.setSize(128, 128);
    this.renderer.setClearColor(0x000000, 0); // שקוף לחלוטין
    
    // הגדרת סצנה
    this.scene = new THREE.Scene();
    
    // --- תיקון קריטי: הגדרת מצלמה כמו ב-Viewer שעובד ---
    // המצלמה ב-Viewer היא: (0, -8, 4). כאן שמתי 5 כדי להבטיח שהאוטובוס כולו בפריים
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    this.camera.position.set(0, -8, 5); 
    this.camera.lookAt(0, 0, 0);
    
    // --- תאורה (כמו ב-Viewer) ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, -5, 5);
    this.scene.add(directionalLight2);
    
    console.log('✅ Three.js renderer initialized');
  }

  loadBusModel() {
    const loader = new THREE.GLTFLoader();
    // שימוש בקישור שנתת שעובד ב-Viewer
    const glbPath = 'https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb';
    
    loader.load(
      glbPath,
      (gltf) => {
        this.glbModel = gltf.scene;
        
        // --- תיקון: ביטלתי את חישובי ה-Bounding Box ---
        // החישובים האלה גרמו למודל "לברוח" מהמרכז.
        // אנחנו סומכים על המודל שהוא במרכז (0,0,0) כפי שהוא ב-Viewer.
        
        // אם האוטובוס נראה קטן מדי, אפשר להגדיל אותו כאן:
        // this.glbModel.scale.set(1.2, 1.2, 1.2);

        this.modelLoaded = true;
        console.log(`✅ Model loaded successfully!`);
        
        // עיבוד אוטובוסים שחיכו לטעינה
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
      undefined, // onProgress
      (error) => {
        console.error('❌ Error loading model:', error);
      }
    );
  }

  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map) return;
    if (!Array.isArray(vehicles)) return;

    vehicles.forEach(v => {
      try {
        let lon = v.lon;
        let lat = v.lat;
        
        // השלמת מיקום אם חסר
        if ((!lat || !lon) && typeof v.positionOnLine === "number" && shapeCoords) {
            const idx = Math.floor(v.positionOnLine * (shapeCoords.length - 1));
            const point = shapeCoords[idx];
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
              vehicleId, lon, lat, bearing, color, routeNumber: v.routeNumber
            });
          } else {
            this.draw3DBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
          }
        }
      } catch (e) {
        console.error("❌ Error in drawBuses:", e);
      }
    });
  }

  draw3DBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    let marker = this.busMarkers.get(vehicleId);
    
    if (marker) {
      // עדכון מיקום (אנימציה)
      this.animateBusTo(vehicleId, lon, lat, 2000);
      
      // עדכון סיבוב וצבע רק אם השתנו משמעותית
      const el = marker.getElement();
      if (el && el._busData) {
        if (Math.abs(el._busData.bearing - bearing) > 5 || el._busData.color !== color) {
            el._busData.bearing = bearing;
            el._busData.color = color;
            this.updateBusImage(el, color, bearing, routeNumber);
        }
      }
    } else {
      // יצירת מרקר חדש
      const el = this.createBusElement(color, bearing, routeNumber);
      
      marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
        rotationAlignment: 'map', // מסתובב עם המפה
        pitchAlignment: 'viewport' // נשאר עומד בהטיה
      })
        .setLngLat([lon, lat])
        .addTo(this.map);
      
      this.busMarkers.set(vehicleId, marker);
    }
  }

  createBusElement(color, bearing, routeNumber) {
    const container = document.createElement('div');
    container.className = 'bus-3d-marker';
    // גודל המרקר על המפה
    container.style.width = '50px'; 
    container.style.height = '50px';
    container.style.position = 'relative';
    container.style.cursor = 'pointer';
    
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    container._busData = {
      canvas: canvas,
      color: color,
      bearing: bearing,
      routeNumber: routeNumber
    };
    
    this.renderBusToCanvas(canvas, color, bearing);
    
    container.appendChild(canvas);
    
    // תווית מספר קו
    if (routeNumber) {
      const badge = document.createElement('div');
      badge.className = 'route-badge-3d';
      badge.style.cssText = `
        position: absolute;
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        padding: 2px 5px;
        background: white;
        border: 2px solid ${color};
        border-radius: 6px;
        font-weight: 800;
        font-size: 11px;
        color: #333;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        pointer-events: none;
        z-index: 10;
        white-space: nowrap;
      `;
      badge.textContent = routeNumber;
      container.appendChild(badge);
    }
    
    return container;
  }

  renderBusToCanvas(targetCanvas, color, bearing) {
    if (!this.glbModel || !this.renderer || !this.scene) return;
    
    // שיבוט המודל
    const busModel = this.glbModel.clone(true);
    
    // צביעת המודל
    busModel.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone(); 
        const threeColor = new THREE.Color(color);
        child.material.color.set(threeColor);
      }
    });
    
    // סיבוב - המרה למעלות
    // Z הוא הציר המסתובב במבט על
    busModel.rotation.z = (bearing * Math.PI / 180); 
    
    // איפוס מיקום מוחלט
    busModel.position.set(0, 0, 0);

    this.scene.add(busModel);
    this.renderer.render(this.scene, this.camera);
    
    // העתקה לקנבס המטרה
    const ctx = targetCanvas.getContext('2d');
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.drawImage(this.renderer.domElement, 0, 0, targetCanvas.width, targetCanvas.height);
    
    // ניקוי
    this.scene.remove(busModel);
    
    // שחרור זיכרון חומרים
    busModel.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material.dispose();
        }
    });
  }

  updateBusImage(element, color, bearing, routeNumber) {
    if (!element._busData) return;
    this.renderBusToCanvas(element._busData.canvas, color, bearing);
  }

  pruneMarkers(activeVehicleIds) {
    if (!activeVehicleIds) return;
    this.busMarkers.forEach((marker, id) => {
      if (!activeVehicleIds.has(id)) {
        marker.remove();
        this.busMarkers.delete(id);
      }
    });
  }

  clearAll() {
    this.busMarkers.forEach(marker => marker.remove());
    this.busMarkers.clear();
  }

  animateBusTo(vehicleId, newLon, newLat, duration = 2000) {
    const marker = this.busMarkers.get(vehicleId);
    if (!marker) return;

    const start = marker.getLngLat();
    const startTime = performance.now();
    
    const animate = (time) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const t = progress * (2 - progress); // Ease out
      
      const lng = start.lng + (newLon - start.lng) * t;
      const lat = start.lat + (newLat - start.lat) * t;
      
      marker.setLngLat([lng, lat]);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }
}
