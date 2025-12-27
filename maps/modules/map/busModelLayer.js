// modules/map/busModelLayer.js
// שכבת 3D (Mapbox CustomLayer) שמציגה מודל GLB לכל הרכבים.
// חשוב: אין צורך להוסיף <script> של three/GLTFLoader ב-view.js — הקובץ הזה טוען אותם לבד עם fallback.

// ---- MODEL TUNING (touch editor) ----
const MODEL_YAW_OFFSET_DEG = (typeof window !== 'undefined' && typeof window.MODEL_YAW_OFFSET_DEG === 'number') ? window.MODEL_YAW_OFFSET_DEG : -51.75;
const MODEL_BASE_ROT_X_DEG = (typeof window !== 'undefined' && typeof window.MODEL_BASE_ROT_X_DEG === 'number') ? window.MODEL_BASE_ROT_X_DEG : 88.25;
const MODEL_BASE_ROT_Y_DEG = (typeof window !== 'undefined' && typeof window.MODEL_BASE_ROT_Y_DEG === 'number') ? window.MODEL_BASE_ROT_Y_DEG : 0;
const MODEL_BASE_ROT_Z_DEG = (typeof window !== 'undefined' && typeof window.MODEL_BASE_ROT_Z_DEG === 'number') ? window.MODEL_BASE_ROT_Z_DEG : 0;

const OFFSET_EAST_M  = (typeof window !== 'undefined' && typeof window.OFFSET_EAST_M  === 'number') ? window.OFFSET_EAST_M  : 0;
const OFFSET_NORTH_M = (typeof window !== 'undefined' && typeof window.OFFSET_NORTH_M === 'number') ? window.OFFSET_NORTH_M : 0;
const OFFSET_UP_M    = (typeof window !== 'undefined' && typeof window.OFFSET_UP_M    === 'number') ? window.OFFSET_UP_M    : 0;

const SCALE_MUL      = (typeof window !== 'undefined' && typeof window.SCALE_MUL      === 'number') ? window.SCALE_MUL      : 1;
const MODEL_SCALE    = (typeof window !== 'undefined' && typeof window.MODEL_SCALE    === 'number') ? window.MODEL_SCALE    : 1;

function _deg2rad(d){ return d * Math.PI / 180; }

function _wrap180(deg) {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}
function _unwrapToNearest(prevDeg, targetDeg) {
  const delta = _wrap180(targetDeg - prevDeg);
  return prevDeg + delta;
}

function _loadScriptOnce(url) {
  return new Promise((resolve, reject) => {
    try {
      const existing = document.querySelector(`script[data-kavnav-src="${url}"]`);
      if (existing && existing.getAttribute("data-kavnav-loaded") === "1") return resolve(true);
      if (existing) {
        existing.addEventListener("load", () => resolve(true));
        existing.addEventListener("error", () => reject(new Error("script failed: " + url)));
        return;
      }

      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.defer = true;
      s.setAttribute("data-kavnav-src", url);

      s.onload = () => { s.setAttribute("data-kavnav-loaded", "1"); resolve(true); };
      s.onerror = () => reject(new Error("script failed: " + url));

      (document.head || document.documentElement).appendChild(s);
    } catch (e) {
      reject(e);
    }
  });
}

async function _ensureThreeAndLoader() {
  const hasThree = (typeof window.THREE !== 'undefined');
  const hasLoader = hasThree && (typeof window.THREE.GLTFLoader !== 'undefined');
  if (hasThree && hasLoader) return true;

  console.log("⏳ Loading Three.js / GLTFLoader (fallbacks)...");

  // Three.js (גלובלי)
  if (!hasThree) {
    const threeUrls = [
      "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
      "https://unpkg.com/three@0.128.0/build/three.min.js",
      "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"
    ];
    let ok = false;
    for (const u of threeUrls) {
      try { await _loadScriptOnce(u); ok = (typeof window.THREE !== 'undefined'); if (ok) break; } catch (e) {}
    }
    if (!ok) throw new Error("Three.js failed to load from all sources");
  }

  // GLTFLoader (לתוך THREE.GLTFLoader)
  if (typeof window.THREE.GLTFLoader === 'undefined') {
    const loaderUrls = [
      "https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js",
      "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"
    ];
    let ok = false;
    for (const u of loaderUrls) {
      try { await _loadScriptOnce(u); ok = (typeof window.THREE.GLTFLoader !== 'undefined'); if (ok) break; } catch (e) {}
    }
    if (!ok) throw new Error("GLTFLoader failed to load from all sources");
  }

  console.log("✅ Three.js and GLTFLoader are ready");
  return true;
}

class BusModelLayer {
  constructor(options = {}) {
    this.id = options.id || "bus-glb-layer";
    this.type = "custom";
    this.renderingMode = "3d";

    // ✅ ברירת מחדל ל-GLB שלך
    this.glbUrl = options.glbUrl || (window.BUS_GLB_URL || "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb");
    this.modelAltMeters = (typeof options.modelAltMeters === "number") ? options.modelAltMeters : 0;

    this._map = null;
    this._renderer = null;
    this._scene = null;
    this._camera = null;

    this._template = null;
    this._templateReady = false;
    this._ready = false;

    this._vehicles = new Map();
    this._yawSmoothed = new Map();

    this._qBase = null;
    this._qYaw = null;
    this._qOut = null;
    this._axisZ = null;

    this._initPromise = null;
  }

  async _initThree(map, gl) {
    await _ensureThreeAndLoader();

    const THREE = window.THREE;

    this._scene = new THREE.Scene();
    this._camera = new THREE.Camera();

    this._renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true
    });
    this._renderer.autoClear = false;

    // Lights
    this._scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(10, -10, 20);
    this._scene.add(dir);

    this._qBase = new THREE.Quaternion();
    this._qYaw  = new THREE.Quaternion();
    this._qOut  = new THREE.Quaternion();
    this._axisZ = new THREE.Vector3(0, 0, 1);

    // base rotation
    const e = new THREE.Euler(
      _deg2rad(MODEL_BASE_ROT_X_DEG),
      _deg2rad(MODEL_BASE_ROT_Y_DEG),
      _deg2rad(MODEL_BASE_ROT_Z_DEG),
      "XYZ"
    );
    this._qBase.setFromEuler(e);

    console.log("📦 Loading GLB:", this.glbUrl);
    const loader = new THREE.GLTFLoader();
    loader.load(
      this.glbUrl,
      (gltf) => {
        this._template = gltf.scene;
        this._templateReady = true;
        this._ready = true;
        console.log("✅ GLB loaded OK");
        try { map.triggerRepaint(); } catch (e) {}
      },
      undefined,
      (err) => console.error("❌ GLB load error:", err)
    );
  }

  onAdd(map, gl) {
    this._map = map;
    this._initPromise = this._initThree(map, gl).catch(e => {
      console.error("❌ BusModelLayer init failed:", e);
    });
  }

  _getOrCreateVehicle(id) {
    if (!this._templateReady || !this._template) return null;
    let obj = this._vehicles.get(id);
    if (obj) return obj;

    const THREE = window.THREE;
    obj = this._template.clone(true);
    this._scene.add(obj);
    this._vehicles.set(id, obj);
    return obj;
  }

  // vehicles: [{id, lon, lat, bearingDeg}] (bearingDeg = כיוון נסיעה)
  upsertVehicles(vehicles) {
    if (!this._ready || !Array.isArray(vehicles) || vehicles.length === 0) return;

    for (const v of vehicles) {
      if (!v) continue;
      const id = v.id || v.vehicleId || v.vid;

      const lon = (typeof v.lon === "number") ? v.lon
        : (typeof v.lng === "number") ? v.lng
        : (typeof v.longitude === "number") ? v.longitude
        : null;

      const lat = (typeof v.lat === "number") ? v.lat
        : (typeof v.latitude === "number") ? v.latitude
        : null;

      if (!id || typeof lon !== "number" || typeof lat !== "number") continue;

      const obj = this._getOrCreateVehicle(id);
      if (!obj) continue;

      const mc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: lon, lat: lat }, this.modelAltMeters);
      const s = mc.meterInMercatorCoordinateUnits();

      obj.position.set(
        mc.x + OFFSET_EAST_M * s,
        mc.y - OFFSET_NORTH_M * s,
        mc.z + OFFSET_UP_M * s
      );

      const finalScale = MODEL_SCALE * s * SCALE_MUL;
      obj.scale.set(finalScale, finalScale, finalScale);

      const brng = (typeof v.bearingDeg === "number") ? v.bearingDeg
        : (typeof v.bearing === "number") ? v.bearing
        : 0;

      const targetYawDeg = brng + MODEL_YAW_OFFSET_DEG;

      let sm = this._yawSmoothed.get(id);
      if (sm == null) sm = targetYawDeg;
      sm = _unwrapToNearest(sm, targetYawDeg);
      this._yawSmoothed.set(id, sm);

      const yawRad = _deg2rad(sm);

      this._qYaw.setFromAxisAngle(this._axisZ, -yawRad);
      this._qOut.copy(this._qYaw).multiply(this._qBase);
      obj.quaternion.copy(this._qOut);
    }

    try { this._map.triggerRepaint(); } catch (e) {}
  }

  clearAll() {
    if (!this._scene) return;
    for (const [, obj] of this._vehicles.entries()) {
      try { this._scene.remove(obj); } catch (e) {}
    }
    this._vehicles.clear();
    this._yawSmoothed.clear();
  }

  render(gl, matrix) {
    if (!this._renderer || !this._scene || !this._camera || !this._ready) return;

    const THREE = window.THREE;
    this._camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

    try {
      if (this._renderer.state && this._renderer.state.reset) this._renderer.state.reset();
      if (this._renderer.resetState) this._renderer.resetState();
    } catch (e) {}

    this._renderer.render(this._scene, this._camera);
  }
}

// expose globally (כדי להתאים לקוד קיים)
window.BusModelLayer = BusModelLayer;