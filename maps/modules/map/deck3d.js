// modules/map/deck3d.js
// 3D buses overlay using deck.gl ScenegraphLayer above Leaflet

class Deck3D {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = null;

    this.deckInstance = null;
    this.canvas = null;

    this.vehicles = [];

    // ✅ כאן אתה מכניס את הקישור ל-GLB שלך:
    this.DEFAULT_MODEL_URL =
      "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/deckgl-3d/maps/Bus4glb.glb";

    // כוונונים
    this.modelScale = 18;        // תגדיל/תקטין לפי איך שזה נראה אצלך
    this.zIndex = 450;           // מעל אריחים/פוליליינים
  }

  async init() {
    if (!this.mapManager || !this.mapManager.getMap) {
      throw new Error("Deck3D: invalid mapManager");
    }
    this.map = this.mapManager.getMap();
    if (!this.map) {
      throw new Error("Deck3D: Leaflet map is null");
    }
    if (!window.deck) {
      throw new Error("Deck3D: deck.gl not loaded (window.deck missing)");
    }

    const mapEl = this.map.getContainer();
    mapEl.style.position = mapEl.style.position || "relative";

    // Canvas overlay
    this.canvas = document.createElement("canvas");
    this.canvas.id = "deck3d-canvas";
    this.canvas.style.position = "absolute";
    this.canvas.style.left = "0";
    this.canvas.style.top = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = String(this.zIndex);

    mapEl.appendChild(this.canvas);

    // Deck instance
    this.deckInstance = new window.deck.Deck({
      canvas: this.canvas,
      controller: false,
      initialViewState: this._getViewState(),
      layers: [],
    });

    // Bind Leaflet events
    this.map.on("move", () => this._syncView());
    this.map.on("zoom", () => this._syncView());
    this.map.on("resize", () => this._resize());

    // initial
    this._resize();
    this._syncView(true);

    return true;
  }

  setVehicles(list) {
    if (!Array.isArray(list)) list = [];
    this.vehicles = list;
    this._render();
  }

  _getViewState() {
    const c = this.map.getCenter();
    const z = this.map.getZoom();

    // ⚠️ pitch חייב להיות 0 כדי להישאר מיושר ל-Leaflet tiles.
    return {
      longitude: c.lng,
      latitude: c.lat,
      zoom: z,
      pitch: 0,
      bearing: 0,
    };
  }

  _syncView(force) {
    if (!this.deckInstance) return;
    this.deckInstance.setProps({ viewState: this._getViewState() });
    if (force) this.deckInstance.redraw(true);
  }

  _resize() {
    if (!this.deckInstance || !this.canvas) return;

    const mapEl = this.map.getContainer();
    const w = mapEl.clientWidth;
    const h = mapEl.clientHeight;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));

    this.deckInstance.setProps({ width: w, height: h });
    this.deckInstance.redraw(true);
  }

  _hexToRgb(hex) {
    if (!hex) return [41, 182, 246];
    const h = hex.replace("#", "").trim();
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return [r, g, b];
    }
    if (h.length >= 6) {
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      return [r, g, b];
    }
    return [41, 182, 246];
  }

  _render() {
    if (!this.deckInstance) return;

    const data = this.vehicles.map((v) => ({
      position: [v.lon, v.lat, 0],
      bearing: typeof v.bearing === "number" ? v.bearing : 0,
      color: this._hexToRgb(v.color),
      route: v.route || "",
    }));

    const layer = new window.deck.ScenegraphLayer({
      id: "kavnav-buses-3d",
      data,
      scenegraph: this.DEFAULT_MODEL_URL,

      // מיקום/סקייל
      getPosition: (d) => d.position,
      sizeScale: this.modelScale,
      getScale: (d) => [1, 1, 1],

      // כיוון: לפעמים צריך להפוך סימן/צירים לפי המודל.
      // אם האוטובוסים “פונים הפוך”, תשנה את ה- yaw כאן.
      getOrientation: (d) => [0, -d.bearing, 90],

      // צבע
      getColor: (d) => d.color,

      // ביצועים
      pickable: false,
      _lighting: "pbr",
      // opacity: 1,  // אפשר להוסיף אם צריך
    });

    this.deckInstance.setProps({ layers: [layer] });
    this.deckInstance.redraw(true);
  }
}