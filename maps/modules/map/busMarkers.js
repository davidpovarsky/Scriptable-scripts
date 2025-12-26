// modules/map/busMarkers.js
// תיקון: זווית מצלמה איזומטרית, תיקון קואורדינטות, ומניעת חיתוך (Clipping)

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();
    this.busMarkers = new Map();
    this.glbModel = null;
    this.modelLoaded = false;
    
    // הגדרות Three.js
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.pendingBuses = [];
    
    this.loadThreeJS();
    
    console.log("🚌 BusMarkers initialized (Fixed Camera & Coords)");
  }

  loadThreeJS() {
    if (typeof THREE !== 'undefined') {
      this.initGLTFLoader();
      return;
    }

    const threeScript = document.createElement('script');
    threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    threeScript.onload = () => {
      this.initGLTFLoader();
    };
    document.head.appendChild(threeScript);
  }

  initGLTFLoader() {
    const loaderScript = document.createElement('script');
    loaderScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
    loaderScript.onload = () => {
      this.setupRenderer();
      this.loadBusModel();
    };
    document.head.appendChild(loaderScript);
  }

  setupRenderer() {
    // 1. יצירת קנבס בגודל סביר (לא גדול מדי שלא יכביד, לא קטן מדי שלא יתפקסל)
    const canvas = document.createElement('canvas');
    canvas.width = 150; 
    canvas.height = 150;
    
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: canvas,
      alpha: true, // חובה לרקע שקוף
      antialias: true
    });
    
    this.scene = new THREE.Scene();
    
    // --- תיקון המצלמה (הבעיה של החיתוך) ---
    // במקום (0, -8, 4) שהיה קרוב מדי, התרחקנו.
    // שמנו את המצלמה בזווית "פינתית" (5, -8, 6) כדי שיראו תלת מימד יפה
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(6, -8, 6); 
    this.camera.lookAt(0, 0, 1); // מסתכל למרכז האוטובוס בערך
    
    // תאורה חזקה כדי שהמודל לא ייראה שטוח
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 10, 10);
    this.scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(-10, -10, 5);
    this.scene.add(backLight);
  }

  loadBusModel() {
    const loader = new THREE.GLTFLoader();
    const glbPath = 'https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb';
    
    loader.load(glbPath, (gltf) => {
      this.glbModel = gltf.scene;
      
      // --- תיקון גודל המודל ---
      // לפעמים המודל המקורי ענק. כאן אנחנו מקטינים אותו מעט
      // כדי להבטיח שהוא ייכנס בפריים של המרקר
      this.glbModel.scale.set(0.8, 0.8, 0.8);
      
      // איפוס רוטציה התחלתית אם יש
      this.glbModel.rotation.set(0, 0, 0);

      this.modelLoaded = true;
      console.log("✅ 3D Model Loaded & Scaled");
      
      // ציור אוטובוסים שחיכו לטעינה
      if (this.pendingBuses.length > 0) {
        this.pendingBuses.forEach(b => {
          this.draw3DBus(b.id, b.lon, b.lat, b.bearing, b.color, b.route);
        });
        this.pendingBuses = [];
      }
    });
  }

  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map || !vehicles) return;

    vehicles.forEach(v => {
      let lon = v.lon;
      let lat = v.lat;
      
      // ניסיון לחלץ מיקום אם חסר, לפי ההתקדמות על הקו
      if ((!lat || !lon) && typeof v.positionOnLine === "number" && shapeCoords && shapeCoords.length > 1) {
        const idx = Math.floor(v.positionOnLine * (shapeCoords.length - 1));
        const point = shapeCoords[idx]; // point הוא [lon, lat] בדרך כלל
        if (point) {
          lon = point[0];
          lat = point[1];
        }
      }
      
      if (lat && lon) {
        // --- תיקון ישראל (Coordinates Swap Fix) ---
        // בישראל: Longitude ~34-35, Latitude ~29-33
        // אם ה-Lat גדול מה-Lon, כנראה שהם הפוכים
        if (lat > lon && lat > 33 && lon < 34) {
             const temp = lat;
             lat = lon;
             lon = temp;
        }
        
        // בדיקת שפיות: אם זה עדיין לא בישראל, אל תצייר כדי לא לבלבל
        // (גבולות גסים של ישראל)
        if (lon < 34 || lon > 36 || lat < 29 || lat > 34) {
            // console.warn("Bus coordinate out of Israel range:", lon, lat);
            // אפשר להחליט אם לסנן או לא. כרגע נשאיר.
        }

        const vehicleId = v.vehicleId || `${v.routeNumber}-${v.tripId}`;
        const bearing = v.bearing || 0;
        
        if (!this.modelLoaded) {
          this.pendingBuses.push({
            id: vehicleId, lon, lat, bearing, color, route: v.routeNumber
          });
        } else {
          this.draw3DBus(vehicleId, lon, lat, bearing, color, v.routeNumber);
        }
      }
    });
    
    // ניקוי אוטובוסים שנעלמו מהפיד
    const currentIds = new Set(vehicles.map(v => v.vehicleId || `${v.routeNumber}-${v.tripId}`));
    this.pruneMarkers(currentIds);
  }

  draw3DBus(vehicleId, lon, lat, bearing, color, routeNumber) {
    let marker = this.busMarkers.get(vehicleId);
    
    if (marker) {
      // עדכון מיקום חלק (אנימציה)
      this.animateBusTo(vehicleId, lon, lat);
      
      // עדכון גרפיקה (צבע/כיוון) רק אם צריך
      const el = marker.getElement();
      if (el && el._busData) {
        // נעדכן תמונה רק אם הזווית השתנתה משמעותית (>5 מעלות) או הצבע השתנה
        if (Math.abs(el._busData.bearing - bearing) > 5 || el._busData.color !== color) {
          el._busData.bearing = bearing;
          el._busData.color = color;
          this.updateBusImage(el, color, bearing, routeNumber);
        }
      }
    } else {
      // יצירה ראשונית
      const el = this.createBusElement(color, bearing, routeNumber);
      
      marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center', // המרכז של התמונה הוא המיקום
        pitchAlignment: 'viewport' // האוטובוס נשאר "עומד" גם כשהמפה נוטה
      })
      .setLngLat([lon, lat])
      .addTo(this.map);
      
      this.busMarkers.set(vehicleId, marker);
    }
  }

  createBusElement(color, bearing, routeNumber) {
    const container = document.createElement('div');
    container.className = 'bus-3d-marker';
    // גודל האלמנט במפה - מספיק גדול שיראו
    container.style.width = '60px'; 
    container.style.height = '60px';
    
    const canvas = document.createElement('canvas');
    canvas.width = 150; // רזולוציה פנימית גבוהה
    canvas.height = 150;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    container.appendChild(canvas);
    
    // תווית מספר קו
    if (routeNumber) {
      const badge = document.createElement('div');
      badge.style.cssText = `
        position: absolute;
        top: -5px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        border: 2px solid ${color};
        color: black;
        font-weight: bold;
        font-size: 11px;
        padding: 1px 4px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        z-index: 10;
        pointer-events: none;
      `;
      badge.textContent = routeNumber;
      container.appendChild(badge);
    }

    container._busData = { canvas, color, bearing, routeNumber };
    
    // רינדור ראשוני
    this.renderToCanvas(canvas, color, bearing);
    
    return container;
  }

  renderToCanvas(canvas, color, bearing) {
    if (!this.glbModel || !this.renderer) return;

    // שכפול המודל כדי לא להרוס לאחרים
    const modelClone = this.glbModel.clone(true);
    
    // צביעה
    const threeColor = new THREE.Color(color);
    modelClone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.color.set(threeColor);
      }
    });

    // סיבוב האוטובוס שיתאים לכיוון הנסיעה
    // ב-GLB הזה, Z הוא הציר למעלה, אז אנחנו מסובבים סביבו
    // ייתכן שנצטרך להוסיף 90 או 180 מעלות תלוי איך המודל בנוי
    modelClone.rotation.z = THREE.Math.degToRad(bearing); 

    this.scene.add(modelClone);
    this.renderer.render(this.scene, this.camera);
    
    // העתקת הפיקסלים לקנבס של המרקר הספציפי
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.renderer.domElement, 0, 0, canvas.width, canvas.height);
    
    // ניקוי
    this.scene.remove(modelClone);
    
    // ניקוי זיכרון חלקי
    modelClone.traverse((c) => { if (c.isMesh) c.material.dispose(); });
  }

  animateBusTo(vehicleId, targetLon, targetLat) {
    const marker = this.busMarkers.get(vehicleId);
    if (!marker) return;
    
    const start = marker.getLngLat();
    const startTime = performance.now();
    const duration = 2000; // 2 שניות אנימציה
    
    const animate = (time) => {
      const p = Math.min((time - startTime) / duration, 1);
      
      const newLng = start.lng + (targetLon - start.lng) * p;
      const newLat = start.lat + (targetLat - start.lat) * p;
      
      marker.setLngLat([newLng, newLat]);
      
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  pruneMarkers(activeIds) {
    this.busMarkers.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        this.busMarkers.delete(id);
      }
    });
  }
}
