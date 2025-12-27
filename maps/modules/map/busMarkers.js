// modules/map/busMarkers.js
// מימוש Three.js GLB Layer מלא עבור Mapbox
// מחליף את busMarkers הישן לחלוטין

class BusMarkers {
  constructor(mapManager) {
    this.id = 'three-bus-layer';
    this.type = 'custom';
    this.renderingMode = '3d';
    
    this.mapManager = mapManager;
    this.map = null; // יוזן ב-onAdd
    
    // Three.js objects
    this.camera = null;
    this.scene = null;
    this.renderer = null;
    this.baseModel = null; // המודל הנטען
    
    // ניהול רכבים
    // key: vehicleId, value: { mesh: THREE.Group, targetPos: [lng,lat], currentPos: [lng,lat], targetBearing: deg, currentYaw: deg }
    this.vehicles = new Map();
    
    // ===== הגדרות מודל =====
    this.GLB_URL = "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb";
    this.MODEL_SCALE = 45;
    this.MODEL_ALT_METERS = 0;
    
    // Tuning offsets - כיוונון המודל
    this.MODEL_YAW_OFFSET_DEG = -51.75;
    this.MODEL_BASE_ROT_X_DEG = 88.25;
    this.MODEL_BASE_ROT_Y_DEG = 0;
    this.MODEL_BASE_ROT_Z_DEG = 0;
    
    this.OFFSET_EAST_M = 0;
    this.OFFSET_NORTH_M = 0;
    this.OFFSET_UP_M = 0;
    
    // Quaternions reused for calculations (חיסכון בזיכרון)
    if (typeof THREE !== 'undefined') {
        this.qBase = new THREE.Quaternion();
        this.qYaw = new THREE.Quaternion();
        this.qOut = new THREE.Quaternion();
        this.axisZ = new THREE.Vector3(0, 0, 1);
        
        // אתחול כיוון בסיס
        this.updateBaseQuaternion(false);
    }
    
    console.log("🚌 BusMarkers (Three.js GLB) initialized");
  }

  // חישוב האוריינטציה הבסיסית של המודל
  updateBaseQuaternion(flipX180) {
    if (typeof THREE === 'undefined') return;
    
    const deg2rad = Math.PI / 180;
    let rxDeg = this.MODEL_BASE_ROT_X_DEG + (flipX180 ? 180 : 0);
    let ryDeg = this.MODEL_BASE_ROT_Y_DEG;
    let rzDeg = this.MODEL_BASE_ROT_Z_DEG;

    const e = new THREE.Euler(rxDeg * deg2rad, ryDeg * deg2rad, rzDeg * deg2rad, "XYZ");
    this.qBase.setFromEuler(e);
  }

  // ================= Mapbox Custom Layer Methods =================

  onAdd(map, gl) {
    this.map = map;
    
    if (typeof THREE === 'undefined') {
        console.error("❌ Three.js not loaded!");
        return;
    }

    // אתחול סצנת Three.js
    this.camera = new THREE.Camera();
    this.scene = new THREE.Scene();
    
    // תאורה
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(10, -10, 20);
    this.scene.add(dirLight);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true
    });
    this.renderer.autoClear = false;

    // טעינת המודל
    const loader = new THREE.GLTFLoader();
    loader.load(
      this.GLB_URL,
      (gltf) => {
        this.baseModel = gltf.scene;
        console.log("🚌 GLB Model Loaded successfully!");
        // יצירת רכבים שחיכו לטעינה
        this.syncMeshes(); 
      },
      undefined,
      (err) => console.error("❌ GLB load error:", err)
    );
  }

  render(gl, matrix) {
    if (!this.scene || !this.renderer || !this.map) return;
    
    // סנכרון המצלמה למטריצה של Mapbox
    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
    
    // עדכון מיקום וסיבוב לכל אוטובוס (אנימציה)
    this.animateVehicles();

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    
    // דרישת פריים נוסף כל עוד יש רכבים
    if (this.vehicles.size > 0) {
      this.map.triggerRepaint();
    }
  }

  onRemove() {
    if (this.scene) {
      this.scene.traverse(obj => {
        if (obj.isMesh) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
             if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
             else obj.material.dispose();
          }
        }
      });
    }
    this.vehicles.clear();
    this.baseModel = null;
    this.renderer = null;
  }

  // ================= Logic & Animation =================

  // פונקציה ראשית שמקבלת עדכונים
  updateVehicles(updates, shapeCoords) {
    if (!Array.isArray(updates)) return;

    // סימון IDs פעילים לניקוי מאוחר יותר
    const activeIds = new Set();

    updates.forEach(u => {
      let lat = u.lat;
      let lon = u.lon;
      const vehicleId = u.vehicleId || `${u.routeNumber}-${u.tripId || Math.random()}`;
      activeIds.add(vehicleId);
      
      // Fallback למיקום אם חסר
      if ((!lat || !lon) && typeof u.positionOnLine === "number" && shapeCoords && shapeCoords.length > 1) {
         const idx = Math.floor(u.positionOnLine * (shapeCoords.length - 1));
         const pt = shapeCoords[idx];
         if (pt) { lon = pt[0]; lat = pt[1]; }
      }

      if (!lat || !lon) return;

      const bearing = u.bearing || 0;

      let vehicle = this.vehicles.get(vehicleId);

      if (vehicle) {
        // עדכון יעד לאנימציה
        vehicle.targetPos = [lon, lat];
        vehicle.targetBearing = bearing;
      } else {
        // רכב חדש
        this.vehicles.set(vehicleId, {
          id: vehicleId,
          mesh: null,
          currentPos: [lon, lat], // התחלה מיידית במיקום החדש
          targetPos: [lon, lat],
          currentYaw: bearing + this.MODEL_YAW_OFFSET_DEG,
          targetBearing: bearing,
          color: u.color || '#ffffff'
        });
      }
    });

    // הסרת רכבים שנעלמו מהעדכון הנוכחי
    this.vehicles.forEach((val, key) => {
      if (!activeIds.has(key)) {
        if (val.mesh && this.scene) this.scene.remove(val.mesh);
        this.vehicles.delete(key);
      }
    });

    // יצירת מודלים חסרים
    this.syncMeshes();
  }

  syncMeshes() {
    if (!this.baseModel || !this.scene) return; 

    this.vehicles.forEach(v => {
      if (!v.mesh) {
        // שכפול המודל
        v.mesh = this.baseModel.clone();
        this.scene.add(v.mesh);
      }
    });
  }

  animateVehicles() {
    if (!this.map || typeof THREE === 'undefined') return;
    
    const lerpFactor = 0.08; // מהירות החלקה
    const deg2rad = Math.PI / 180;

    this.vehicles.forEach(v => {
      if (!v.mesh) return;

      // 1. אינטרפולציה של מיקום (Lerp)
      const curr = v.currentPos;
      const target = v.targetPos;
      
      // אם הקפיצה גדולה מדי (למשל טעינה ראשונית), נקפוץ מיד
      if (Math.abs(curr[0] - target[0]) > 0.01 || Math.abs(curr[1] - target[1]) > 0.01) {
        v.currentPos = [...target];
      } else {
        v.currentPos[0] += (target[0] - curr[0]) * lerpFactor;
        v.currentPos[1] += (target[1] - curr[1]) * lerpFactor;
      }

      // 2. המרה לקואורדינטות Three.js
      const mc = mapboxgl.MercatorCoordinate.fromLngLat(
        { lng: v.currentPos[0], lat: v.currentPos[1] },
        this.MODEL_ALT_METERS
      );
      
      const s = mc.meterInMercatorCoordinateUnits();
      
      v.mesh.position.set(
        mc.x + this.OFFSET_EAST_M * s,
        mc.y - this.OFFSET_NORTH_M * s,
        mc.z + this.OFFSET_UP_M * s
      );

      // סקייל
      const finalScale = this.MODEL_SCALE * s;
      v.mesh.scale.set(finalScale, finalScale, finalScale);

      // 3. חישוב רוטציה (Quaternion)
      const targetYawDeg = v.targetBearing + this.MODEL_YAW_OFFSET_DEG;
      
      // Unwrap logic
      v.currentYaw = this.unwrapToNearest(v.currentYaw, targetYawDeg);
      
      // החלקה
      v.currentYaw += (targetYawDeg - v.currentYaw) * lerpFactor;
      
      const yawRad = v.currentYaw * deg2rad;

      // qYaw * qBase
      this.qYaw.setFromAxisAngle(this.axisZ, -yawRad);
      this.qOut.copy(this.qYaw).multiply(this.qBase);
      
      v.mesh.quaternion.copy(this.qOut);
    });
  }

  // עזרים מתמטיים
  wrap180(deg) {
    return ((deg + 180) % 360 + 360) % 360 - 180;
  }
  
  unwrapToNearest(prevDeg, targetDeg) {
    let delta = this.wrap180(targetDeg - prevDeg);
    return prevDeg + delta;
  }
  
  clearAll() {
    if (this.scene) {
        this.vehicles.forEach(v => {
          if(v.mesh) this.scene.remove(v.mesh);
        });
    }
    this.vehicles.clear();
  }
}
