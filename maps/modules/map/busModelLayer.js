// modules/map/busModelLayer.js
// שכבת Custom Layer ל-Mapbox שמציירת מודל GLB (Three.js) לכל הרכבים (ללא DOM markers)
//
// משתמש ב:
// - Mapbox Custom Layer API (renderingMode: '3d')
// - Three.js r128 + GLTFLoader (נטען דרך <script> ב-view.js)
//
// ⚙️ כיוונון מודל (כמו בקובץ הניסוי):
const BUS_GLB_URL = "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb";

// יחידות/קנה מידה: MODEL_SCALE הוא בערך "מטרים" לפני המרה ל-mercator-units
const MODEL_SCALE = 45;
const MODEL_ALT_METERS = 0;

// ✅ MODEL TUNING (touch editor)
const MODEL_YAW_OFFSET_DEG = -51.75;
const MODEL_BASE_ROT_X_DEG = 88.25;
const MODEL_BASE_ROT_Y_DEG = 0;
const MODEL_BASE_ROT_Z_DEG = 0;

const OFFSET_EAST_M  = 0;
const OFFSET_NORTH_M = 0;
const OFFSET_UP_M    = 0;
const SCALE_MUL      = 1;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function wrap180(deg){
  let d = ((deg + 180) % 360 + 360) % 360 - 180;
  return d;
}
function unwrapToNearest(prevDeg, targetDeg){
  const diff = wrap180(targetDeg - prevDeg);
  return prevDeg + diff;
}

function deepCloneObject3D(obj){
  // לרוב GLB כזה אינו skinned, clone(true) מספיק.
  // אם בעתיד תופיע בעיה של bones/skins - נוסיף SkeletonUtils.
  return obj.clone(true);
}

// ------------------------------------------------------------------
// BusModelLayer
// ------------------------------------------------------------------
class BusModelLayer {
  constructor(map, opts = {}) {
    this.map = map;

    this.layerId = opts.layerId || 'bus-glb-layer';
    this.glbUrl = opts.glbUrl || BUS_GLB_URL;

    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.baseModel = null;
    this.baseModelLoaded = false;

    // id -> { obj, yawDegSmoothed, lastLngLat, prevLngLat }
    this.vehicles = new Map();

    // prebuilt quaternions reused
    this.qBase = new THREE.Quaternion();
    this.qYaw  = new THREE.Quaternion();
    this.qOut  = new THREE.Quaternion();
    this.axisZ = new THREE.Vector3(0, 0, 1);

    this._updateBaseQuaternion();

    // Custom Layer object (Mapbox API)
    this.layer = {
      id: this.layerId,
      type: 'custom',
      renderingMode: '3d',

      onAdd: (map, gl) => {
        try {
          this.scene = new THREE.Scene();
          this.camera = new THREE.Camera();
          this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true
          });
          this.renderer.autoClear = false;

          // Lights
          this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
          const dir = new THREE.DirectionalLight(0xffffff, 0.9);
          dir.position.set(10, -10, 20);
          this.scene.add(dir);

          // Load GLB
          if (!THREE.GLTFLoader) {
            console.error("❌ THREE.GLTFLoader לא נטען. בדוק שב-view.js יש <script> ל-GLTFLoader.");
            return;
          }

          console.log("📦 Loading GLB:", this.glbUrl);
          new THREE.GLTFLoader().load(
            this.glbUrl,
            (gltf) => {
              this.baseModel = gltf.scene;
              this.baseModelLoaded = true;

              // אם כבר קיבלת רכבים לפני הטעינה - צור להם instances עכשיו
              this.vehicles.forEach((entry) => {
                if (!entry.obj) entry.obj = this._createModelInstance();
              });

              console.log("✅ GLB loaded");
              map.triggerRepaint();
            },
            undefined,
            (err) => {
              console.error("❌ Failed loading GLB:", err);
            }
          );
        } catch (e) {
          console.error("❌ BusModelLayer onAdd error:", e);
        }
      },

      render: (gl, matrix) => {
        try {
          if (!this.scene || !this.camera || !this.renderer) return;

          // camera projection matrix from Mapbox
          this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

          this.renderer.state.reset();
          this.renderer.render(this.scene, this.camera);

          this.map.triggerRepaint();
        } catch (e) {
          console.error("❌ BusModelLayer render error:", e);
        }
      }
    };
  }

  addToMap() {
    if (!this.map) return;
    if (this.map.getLayer(this.layerId)) return;

    try {
      this.map.addLayer(this.layer);
      console.log("🧩 Bus GLB layer added:", this.layerId);
    } catch (e) {
      console.error("❌ Failed to add Bus GLB layer:", e);
    }
  }

  _updateBaseQuaternion() {
    const deg2rad = Math.PI / 180;
    const e = new THREE.Euler(
      MODEL_BASE_ROT_X_DEG * deg2rad,
      MODEL_BASE_ROT_Y_DEG * deg2rad,
      MODEL_BASE_ROT_Z_DEG * deg2rad,
      "XYZ"
    );
    this.qBase.setFromEuler(e);
  }

  _createModelInstance() {
    if (!this.baseModelLoaded || !this.baseModel) return null;
    const obj = deepCloneObject3D(this.baseModel);
    this.scene.add(obj);
    return obj;
  }

  upsertVehicles(vehicleStates) {
    // vehicleStates: Array<{id, lon, lat, bearingDeg?}>
    if (!Array.isArray(vehicleStates)) return;

    vehicleStates.forEach(v => {
      if (!v || !v.id || !isFinite(v.lon) || !isFinite(v.lat)) return;

      let entry = this.vehicles.get(v.id);
      if (!entry) {
        entry = { obj: null, yawDegSmoothed: null, lastLngLat: null, prevLngLat: null };
        this.vehicles.set(v.id, entry);
      }

      // create model instance if possible
      if (!entry.obj && this.baseModelLoaded) {
        entry.obj = this._createModelInstance();
      }

      // update pose even if model not yet loaded (we'll apply later when created)
      entry.lastLngLat = [v.lon, v.lat];

      // Bearing: אם אין – נחשב מהתנועה האחרונה (אם קיימת)
      let brng = (typeof v.bearingDeg === 'number' && isFinite(v.bearingDeg)) ? v.bearingDeg : null;
      if (brng == null && entry.prevLngLat && Array.isArray(entry.prevLngLat)) {
        brng = this._getBearing(entry.prevLngLat, entry.lastLngLat);
      }
      if (brng == null) brng = 0;

      entry.prevLngLat = entry.lastLngLat;

      // Yaw unwrap (מונע 359->0)
      const targetYawDeg = brng + MODEL_YAW_OFFSET_DEG;
      if (entry.yawDegSmoothed == null) entry.yawDegSmoothed = targetYawDeg;
      entry.yawDegSmoothed = unwrapToNearest(entry.yawDegSmoothed, targetYawDeg);

      // Apply if model exists
      if (entry.obj) {
        this._applyTransform(entry.obj, v.lon, v.lat, entry.yawDegSmoothed);
      }
    });

    if (this.map) this.map.triggerRepaint();
  }

  pruneVehicles(activeIdsSet) {
    if (!(activeIdsSet instanceof Set)) return;

    this.vehicles.forEach((entry, id) => {
      if (!activeIdsSet.has(id)) {
        try {
          if (entry.obj) {
            this.scene.remove(entry.obj);
            // NOTE: לא עושים dispose לגיאומטריה/חומרים כדי לא לשבור שיתופים בין clones.
          }
        } catch (e) {
          console.error("❌ Error removing 3D vehicle:", e);
        }
        this.vehicles.delete(id);
      }
    });

    if (this.map) this.map.triggerRepaint();
  }

  _applyTransform(obj, lon, lat, yawDegSmoothed) {
    // Position in mercator
    const mc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: lon, lat: lat }, MODEL_ALT_METERS);
    const s = mc.meterInMercatorCoordinateUnits();

    obj.position.set(
      mc.x + OFFSET_EAST_M  * s,
      mc.y - OFFSET_NORTH_M * s,
      mc.z + OFFSET_UP_M    * s
    );

    // Scale
    const finalScale = MODEL_SCALE * s * SCALE_MUL;
    obj.scale.set(finalScale, finalScale, finalScale);

    // Quaternion composition: qOut = qYaw(world Z, -yawRad) * qBase
    const deg2rad = Math.PI / 180;
    const yawRad = yawDegSmoothed * deg2rad;

    this.qYaw.setFromAxisAngle(this.axisZ, -yawRad);
    this.qOut.copy(this.qYaw).multiply(this.qBase);
    obj.quaternion.copy(this.qOut);
  }

  _getBearing(startLngLat, endLngLat) {
    const startLat = startLngLat[1] * Math.PI / 180;
    const startLng = startLngLat[0] * Math.PI / 180;
    const endLat = endLngLat[1] * Math.PI / 180;
    const endLng = endLngLat[0] * Math.PI / 180;

    const dLng = endLng - startLng;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
              Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }
}