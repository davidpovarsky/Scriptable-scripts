// modules/map/busModelLayer.js
// Mapbox CustomLayer + Three.js GLB buses (ALL vehicles)
// מוסיף אינטרפולציה (החלקה) בין עדכונים + MODEL_SCALE ברירת מחדל כמו בדמו (45)

const DEFAULT_MODEL_SCALE = 45;          // ✅ כמו בדמו HTML
const DEFAULT_SMOOTH_MS   = 800;         // משך החלקה בין עדכונים

function deg2rad(d) { return d * Math.PI / 180; }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

function wrap180(deg) {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}
function unwrapToNearest(prevDeg, targetDeg) {
  const delta = wrap180(targetDeg - prevDeg);
  return prevDeg + delta;
}

function loadScriptOnce(url) {
  return new Promise((resolve, reject) => {
    const key = `data-kavnav-src`;
    const existing = document.querySelector(`script[${key}="${url}"]`);
    if (existing) {
      if (existing.getAttribute("data-kavnav-loaded") === "1") return resolve(true);
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => reject(new Error("script failed: " + url)));
      return;
    }
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.defer = true;
    s.setAttribute(key, url);
    s.onload = () => { s.setAttribute("data-kavnav-loaded", "1"); resolve(true); };
    s.onerror = () => reject(new Error("script failed: " + url));
    (document.head || document.documentElement).appendChild(s);
  });
}

async function ensureThreeAndLoader() {
  if (typeof window.THREE !== "undefined" && typeof window.THREE.GLTFLoader !== "undefined") return true;

  console.log("⏳ Loading Three.js / GLTFLoader (fallbacks)...");
  if (typeof window.THREE === "undefined") {
    const threeUrls = [
      "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
      "https://unpkg.com/three@0.128.0/build/three.min.js",
      "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"
    ];
    let ok = false;
    for (const u of threeUrls) {
      try { await loadScriptOnce(u); ok = typeof window.THREE !== "undefined"; if (ok) break; } catch (e) {}
    }
    if (!ok) throw new Error("Three.js failed to load");
  }

  if (typeof window.THREE.GLTFLoader === "undefined") {
    const loaderUrls = [
      "https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js",
      "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"
    ];
    let ok = false;
    for (const u of loaderUrls) {
      try { await loadScriptOnce(u); ok = typeof window.THREE.GLTFLoader !== "undefined"; if (ok) break; } catch (e) {}
    }
    if (!ok) throw new Error("GLTFLoader failed to load");
  }

  console.log("✅ Three.js and GLTFLoader are ready");
  return true;
}

class BusModelLayer {
  constructor(options = {}) {
    this.id = options.id || "bus-glb-layer";
    this.type = "custom";
    this.renderingMode = "3d";

    this.glbUrl = options.glbUrl || (window.BUS_GLB_URL || "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb");
    this.modelAltMeters = (typeof options.modelAltMeters === "number") ? options.modelAltMeters : (typeof window.MODEL_ALT_METERS === "number" ? window.MODEL_ALT_METERS : 0);

    // ===== tuning (נשמר מהגדרות שלך אם קיימות) =====
    this.MODEL_YAW_OFFSET_DEG = (typeof window.MODEL_YAW_OFFSET_DEG === "number") ? window.MODEL_YAW_OFFSET_DEG : -51.75;
    this.MODEL_BASE_ROT_X_DEG = (typeof window.MODEL_BASE_ROT_X_DEG === "number") ? window.MODEL_BASE_ROT_X_DEG : 88.25;
    this.MODEL_BASE_ROT_Y_DEG = (typeof window.MODEL_BASE_ROT_Y_DEG === "number") ? window.MODEL_BASE_ROT_Y_DEG : 0;
    this.MODEL_BASE_ROT_Z_DEG = (typeof window.MODEL_BASE_ROT_Z_DEG === "number") ? window.MODEL_BASE_ROT_Z_DEG : 0;

    this.OFFSET_EAST_M  = (typeof window.OFFSET_EAST_M  === "number") ? window.OFFSET_EAST_M  : 0;
    this.OFFSET_NORTH_M = (typeof window.OFFSET_NORTH_M === "number") ? window.OFFSET_NORTH_M : 0;
    this.OFFSET_UP_M    = (typeof window.OFFSET_UP_M    === "number") ? window.OFFSET_UP_M    : 0;

    this.SCALE_MUL   = (typeof window.SCALE_MUL === "number") ? window.SCALE_MUL : 1;
    this.MODEL_SCALE = (typeof window.MODEL_SCALE === "number") ? window.MODEL_SCALE : DEFAULT_MODEL_SCALE; // ✅ 45
    this.SMOOTH_MS   = (typeof window.BUS_SMOOTH_MS === "number") ? window.BUS_SMOOTH_MS : DEFAULT_SMOOTH_MS;

    // Three objects
    this._map = null;
    this._renderer = null;
    this._scene = null;
    this._camera = null;

    this._template = null;
    this._templateReady = false;
    this._ready = false;

    // per vehicle animation state
    // id -> { obj, from:{x,y,z,yaw}, to:{x,y,z,yaw}, t0, dur, scale }
    this._states = new Map();

    // reuse math objects
    this._qBase = null;
    this._qYaw = null;
    this._qOut = null;
    this._axisZ = null;

    this._initPromise = null;
  }

  async _initThree(map, gl) {
    await ensureThreeAndLoader();

    const THREE = window.THREE;

    this._scene = new THREE.Scene();
    this._camera = new THREE.Camera();

    this._renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true
    });
    this._renderer.autoClear = false;

    // תאורה (כמו בדמו)
    this._scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(10, -10, 20);
    this._scene.add(dir);

    // base rotation quaternions
    this._qBase = new THREE.Quaternion();
    this._qYaw  = new THREE.Quaternion();
    this._qOut  = new THREE.Quaternion();
    this._axisZ = new THREE.Vector3(0, 0, 1);

    const baseEuler = new THREE.Euler(
      deg2rad(this.MODEL_BASE_ROT_X_DEG),
      deg2rad(this.MODEL_BASE_ROT_Y_DEG),
      deg2rad(this.MODEL_BASE_ROT_Z_DEG),
      "XYZ"
    );
    this._qBase.setFromEuler(baseEuler);

    console.log("📦 Loading GLB:", this.glbUrl);
    const loader = new THREE.GLTFLoader();

    loader.load(
      this.glbUrl,
      (gltf) => {
        this._template = gltf.scene;

        // אופציונלי: לשפר "חדות" וראות של חומרים
        this._template.traverse((o) => {
          if (o && o.isMesh && o.material) {
            o.material.transparent = false;
            o.material.opacity = 1;
            o.material.depthWrite = true;
            o.material.depthTest = true;
          }
        });

        this._templateReady = true;
        this._ready = true;
        console.log("✅ GLB loaded OK (templateReady)");

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

  _getOrCreateState(id) {
    let st = this._states.get(id);
    if (st) return st;
    if (!this._templateReady || !this._template) return null;

    const obj = this._template.clone(true);
    this._scene.add(obj);

    st = {
      obj,
      from: { x: 0, y: 0, z: 0, yaw: 0 },
      to:   { x: 0, y: 0, z: 0, yaw: 0 },
      t0: performance.now(),
      dur: this.SMOOTH_MS,
      scale: 1
    };
    this._states.set(id, st);
    return st;
  }

  // vehicles: [{id, lon, lat, bearingDeg}] (או שדות מקבילים)
  upsertVehicles(vehicles) {
    if (!this._ready || !Array.isArray(vehicles) || vehicles.length === 0) return;

    const now = performance.now();

    for (const v of vehicles) {
      if (!v) continue;

      const id = v.id || v.vehicleId || v.vid;
      if (!id) continue;

      const lon = (typeof v.lon === "number") ? v.lon
        : (typeof v.lng === "number") ? v.lng
        : (typeof v.longitude === "number") ? v.longitude
        : null;

      const lat = (typeof v.lat === "number") ? v.lat
        : (typeof v.latitude === "number") ? v.latitude
        : null;

      if (typeof lon !== "number" || typeof lat !== "number") continue;

      const st = this._getOrCreateState(id);
      if (!st) continue;

      // target Mercator position
      const mc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: lon, lat: lat }, this.modelAltMeters);
      const s = mc.meterInMercatorCoordinateUnits();

      const tx = mc.x + this.OFFSET_EAST_M * s;
      const ty = mc.y - this.OFFSET_NORTH_M * s;
      const tz = mc.z + this.OFFSET_UP_M * s;

      const brng = (typeof v.bearingDeg === "number") ? v.bearingDeg
        : (typeof v.bearing === "number") ? v.bearing
        : 0;

      const targetYaw = brng + this.MODEL_YAW_OFFSET_DEG;

      // אם זו פעם ראשונה – שים ישר ליעד כדי לא "לטוס מה-0"
      const first = (st.obj.position.x === 0 && st.obj.position.y === 0 && st.obj.position.z === 0 && st.from.x === 0 && st.to.x === 0);
      const currentYaw = st.to.yaw;

      // from = המצב הנוכחי של האובייקט (לא "מה שהיה לפני כמה עדכונים")
      st.from.x = first ? tx : st.obj.position.x;
      st.from.y = first ? ty : st.obj.position.y;
      st.from.z = first ? tz : st.obj.position.z;

      st.from.yaw = first ? targetYaw : currentYaw;

      // to = יעד חדש (עם unwrap ליְאו)
      st.to.x = tx;
      st.to.y = ty;
      st.to.z = tz;

      const unwrapped = unwrapToNearest(st.from.yaw, targetYaw);
      st.to.yaw = unwrapped;

      st.t0 = now;
      st.dur = this.SMOOTH_MS;

      // scale (כמו בדמו: MODEL_SCALE=45)
      st.scale = this.MODEL_SCALE * s * this.SCALE_MUL;
      st.obj.scale.set(st.scale, st.scale, st.scale);
    }

    try { this._map.triggerRepaint(); } catch (e) {}
  }

  clearAll() {
    if (!this._scene) return;
    for (const [, st] of this._states.entries()) {
      try { this._scene.remove(st.obj); } catch (e) {}
    }
    this._states.clear();
  }

  render(gl, matrix) {
    if (!this._renderer || !this._scene || !this._camera || !this._ready) return;

    const THREE = window.THREE;
    this._camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

    const now = performance.now();
    let anyAnimating = false;

    // עדכון אנימציה לכל רכב
    for (const [, st] of this._states.entries()) {
      const a = clamp01((now - st.t0) / st.dur);
      if (a < 1) anyAnimating = true;

      const x = st.from.x + (st.to.x - st.from.x) * a;
      const y = st.from.y + (st.to.y - st.from.y) * a;
      const z = st.from.z + (st.to.z - st.from.z) * a;
      st.obj.position.set(x, y, z);

      const yaw = st.from.yaw + (st.to.yaw - st.from.yaw) * a;

      // yaw quaternion around Z, ואז מכפילים ב-base rotation
      this._qYaw.setFromAxisAngle(this._axisZ, -deg2rad(yaw));
      this._qOut.copy(this._qYaw).multiply(this._qBase);
      st.obj.quaternion.copy(this._qOut);
    }

    try {
      if (this._renderer.state && this._renderer.state.reset) this._renderer.state.reset();
      if (this._renderer.resetState) this._renderer.resetState();
    } catch (e) {}

    this._renderer.render(this._scene, this._camera);

    // רק אם יש עדיין אנימציה — נבקש עוד frames (חוסך CPU)
    if (anyAnimating) {
      try { this._map.triggerRepaint(); } catch (e) {}
    }
  }
}

// expose globally (כמו שהקוד הקיים מצפה)
window.BusModelLayer = BusModelLayer;