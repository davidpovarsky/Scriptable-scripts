// modules/map/busModelLayer.js
// שכבת 3D (Custom Layer) שמציגה GLB על Mapbox GL JS עבור *הרבה רכבים*.
// כולל כיוונון:
// MODEL_YAW_OFFSET_DEG = -51.75
// MODEL_BASE_ROT_X_DEG = 88.25
// ועוד...

class BusModelLayer {
  constructor(options = {}) {
    this.id = options.id || 'bus-glb-layer';
    this.type = 'custom';
    this.renderingMode = '3d';

    this.glbUrl =
      options.glbUrl ||
      (window.BUS_GLB_URL ||
        "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb");

    this.modelAltMeters =
      (typeof options.modelAltMeters === 'number')
        ? options.modelAltMeters
        : (typeof window.MODEL_ALT_METERS === 'number' ? window.MODEL_ALT_METERS : 0);

    // ===== tuning =====
    this.MODEL_YAW_OFFSET_DEG =
      (typeof options.MODEL_YAW_OFFSET_DEG === 'number')
        ? options.MODEL_YAW_OFFSET_DEG
        : (typeof window.MODEL_YAW_OFFSET_DEG === 'number' ? window.MODEL_YAW_OFFSET_DEG : -51.75);

    this.MODEL_BASE_ROT_X_DEG =
      (typeof options.MODEL_BASE_ROT_X_DEG === 'number')
        ? options.MODEL_BASE_ROT_X_DEG
        : (typeof window.MODEL_BASE_ROT_X_DEG === 'number' ? window.MODEL_BASE_ROT_X_DEG : 88.25);

    this.MODEL_BASE_ROT_Y_DEG =
      (typeof options.MODEL_BASE_ROT_Y_DEG === 'number')
        ? options.MODEL_BASE_ROT_Y_DEG
        : (typeof window.MODEL_BASE_ROT_Y_DEG === 'number' ? window.MODEL_BASE_ROT_Y_DEG : 0);

    this.MODEL_BASE_ROT_Z_DEG =
      (typeof options.MODEL_BASE_ROT_Z_DEG === 'number')
        ? options.MODEL_BASE_ROT_Z_DEG
        : (typeof window.MODEL_BASE_ROT_Z_DEG === 'number' ? window.MODEL_BASE_ROT_Z_DEG : 0);

    this.FLIP_X_180 =
      (typeof options.FLIP_X_180 === 'boolean')
        ? options.FLIP_X_180
        : (typeof window.FLIP_X_180 === 'boolean' ? window.FLIP_X_180 : false);

    this.OFFSET_EAST_M =
      (typeof options.OFFSET_EAST_M === 'number')
        ? options.OFFSET_EAST_M
        : (typeof window.OFFSET_EAST_M === 'number' ? window.OFFSET_EAST_M : 0);

    this.OFFSET_NORTH_M =
      (typeof options.OFFSET_NORTH_M === 'number')
        ? options.OFFSET_NORTH_M
        : (typeof window.OFFSET_NORTH_M === 'number' ? window.OFFSET_NORTH_M : 0);

    this.OFFSET_UP_M =
      (typeof options.OFFSET_UP_M === 'number')
        ? options.OFFSET_UP_M
        : (typeof window.OFFSET_UP_M === 'number' ? window.OFFSET_UP_M : 0);

    this.SCALE_MUL =
      (typeof options.SCALE_MUL === 'number')
        ? options.SCALE_MUL
        : (typeof window.SCALE_MUL === 'number' ? window.SCALE_MUL : 1);

    this.MODEL_SCALE =
      (typeof options.MODEL_SCALE === 'number')
        ? options.MODEL_SCALE
        : (typeof window.MODEL_SCALE === 'number' ? window.MODEL_SCALE : 1);

    // Three.js objects
    this._map = null;
    this._renderer = null;
    this._scene = null;
    this._camera = null;

    this._template = null;
    this._templateReady = false;

    this._vehicles = new Map();    // id -> THREE.Object3D
    this._yawSmoothed = new Map(); // id -> yaw deg

    this._qBase = null;
    this._qYaw = null;
    this._qOut = null;
    this._axisZ = null;

    this._debugOnce = false;
  }

  _wrap180(deg) {
    return ((deg + 180) % 360 + 360) % 360 - 180;
  }
  _unwrapToNearest(prevDeg, targetDeg) {
    const delta = this._wrap180(targetDeg - prevDeg);
    return prevDeg + delta;
  }

  _updateBaseQuaternion() {
    const deg2rad = Math.PI / 180;

    let rxDeg = this.MODEL_BASE_ROT_X_DEG + (this.FLIP_X_180 ? 180 : 0);
    let ryDeg = this.MODEL_BASE_ROT_Y_DEG;
    let rzDeg = this.MODEL_BASE_ROT_Z_DEG;

    const e = new THREE.Euler(rxDeg * deg2rad, ryDeg * deg2rad, rzDeg * deg2rad, "XYZ");
    this._qBase.setFromEuler(e);
  }

  _getLoaderCtor() {
    // ✅ חסין: לפעמים loader מוגדר כ-THREE.GLTFLoader ולפעמים כ-GLTFLoader גלובלי
    if (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader !== 'undefined') return THREE.GLTFLoader;
    if (typeof GLTFLoader !== 'undefined') return GLTFLoader;
    return null;
  }

  onAdd(map, gl) {
    this._map = map;

    const LoaderCtor = this._getLoaderCtor();
    if (typeof THREE === 'undefined' || !LoaderCtor) {
      console.error("❌ Three.js או GLTFLoader לא נטענו בפועל.",
        "THREE?", typeof THREE !== 'undefined',
        "THREE.GLTFLoader?", (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader !== 'undefined'),
        "GLTFLoader global?", (typeof GLTFLoader !== 'undefined')
      );
      return;
    }

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

    // Reusable math objects
    this._qBase = new THREE.Quaternion();
    this._qYaw = new THREE.Quaternion();
    this._qOut = new THREE.Quaternion();
    this._axisZ = new THREE.Vector3(0, 0, 1);
    this._updateBaseQuaternion();

    // Load template GLB
    console.log("📦 Loading GLB:", this.glbUrl);
    const loader = new LoaderCtor();
    loader.load(
      this.glbUrl,
      (gltf) => {
        this._template = gltf.scene;
        this._templateReady = true;
        console.log("✅ GLB loaded OK");
        try { this._map.triggerRepaint(); } catch (e) {}
      },
      undefined,
      (err) => {
        console.error("❌ GLB load error:", err);
      }
    );
  }

  _getOrCreateVehicle(id) {
    let obj = this._vehicles.get(id);
    if (obj) return obj;

    if (!this._templateReady || !this._template) return null;

    obj = this._template.clone(true);
    this._scene.add(obj);
    this._vehicles.set(id, obj);
    return obj;
  }

  upsertVehicles(vehicles = []) {
    if (!Array.isArray(vehicles) || !vehicles.length) return;
    if (!this._templateReady) return;

    for (const v of vehicles) {
      if (!v || !v.id) continue;
      if (typeof v.lon !== 'number' || typeof v.lat !== 'number') continue;

      const obj = this._getOrCreateVehicle(v.id);
      if (!obj) continue;

      const mc = mapboxgl.MercatorCoordinate.fromLngLat(
        { lng: v.lon, lat: v.lat },
        this.modelAltMeters
      );
      const s = mc.meterInMercatorCoordinateUnits();

      obj.position.set(
        mc.x + this.OFFSET_EAST_M * s,
        mc.y - this.OFFSET_NORTH_M * s,
        mc.z + this.OFFSET_UP_M * s
      );

      const finalScale = this.MODEL_SCALE * s * this.SCALE_MUL;
      obj.scale.set(finalScale, finalScale, finalScale);

      const brng = (typeof v.bearingDeg === 'number') ? v.bearingDeg : 0;
      const targetYawDeg = brng + this.MODEL_YAW_OFFSET_DEG;

      let sm = this._yawSmoothed.get(v.id);
      if (sm == null) sm = targetYawDeg;
      sm = this._unwrapToNearest(sm, targetYawDeg);
      this._yawSmoothed.set(v.id, sm);

      const yawRad = sm * (Math.PI / 180);

      this._qYaw.setFromAxisAngle(this._axisZ, -yawRad);
      this._qOut.copy(this._qYaw).multiply(this._qBase);
      obj.quaternion.copy(this._qOut);
    }
  }

  removeVehicles(ids = []) {
    if (!Array.isArray(ids) || !ids.length) return;
    for (const id of ids) {
      const obj = this._vehicles.get(id);
      if (!obj) continue;
      try { this._scene.remove(obj); } catch (e) {}
      this._vehicles.delete(id);
      this._yawSmoothed.delete(id);
    }
  }

  clearAll() {
    this.removeVehicles(Array.from(this._vehicles.keys()));
  }

  render(gl, matrix) {
    if (!this._renderer || !this._scene || !this._camera) return;

    this._camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

    try {
      if (this._renderer.state && this._renderer.state.reset) this._renderer.state.reset();
      if (this._renderer.resetState) this._renderer.resetState();
    } catch (e) {}

    this._renderer.render(this._scene, this._camera);

    try { this._map && this._map.triggerRepaint && this._map.triggerRepaint(); } catch (e) {}

    if (!this._debugOnce) {
      this._debugOnce = true;
      console.log(`🧩 BusModelLayer rendering. templateReady=${this._templateReady}`);
    }
  }
}