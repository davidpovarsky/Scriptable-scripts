// modules/map/deck3d.js
// שכבת תלת-מימד (deck.gl) שמצוירת מעל Leaflet - ללא export
// נועדה לציור הרבה אוטובוסים בצורה יעילה + מודל GLB

(function () {
  function hexToRgbArray(hex) {
    if (!hex) return [0, 122, 255];
    const h = String(hex).replace("#", "").trim();
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return [r, g, b];
    }
    if (h.length === 6) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return [r, g, b];
    }
    return [0, 122, 255];
  }

  class Deck3D {
    constructor(leafletMap, cfg) {
      this.map = leafletMap;
      this.cfg = Object.assign({
        enabled: true,
        glbUrl: null,
        sizeScale: 25,
        elevationMeters: 6,
        yawOffsetDeg: 0,
        pitchDeg: 50,
        zoomOffset: 0,
      }, cfg || {});

      this._routeVehicles = new Map(); // routeId -> { vehicles, colorHex }
      this._deck = null;
      this._overlay = null;

      this._init();
    }

    _hasDeps() {
      if (!window.deck || !window.deck.Deck) {
        console.warn("🧊 Deck3D disabled: deck.gl not loaded (window.deck missing)");
        return false;
      }
      if (!window.deck.ScenegraphLayer) {
        console.warn("🧊 Deck3D disabled: ScenegraphLayer missing (mesh-layers not loaded?)");
        return false;
      }
      return true;
    }

    _ensureOverlay() {
      const container = this.map.getContainer();
      if (!container.style.position) container.style.position = "relative";

      let overlay = document.getElementById("deckOverlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "deckOverlay";
        overlay.style.position = "absolute";
        overlay.style.inset = "0";
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "500";
        container.appendChild(overlay);
      }
      this._overlay = overlay;
    }

    _leafletViewState() {
      const c = this.map.getCenter();
      return {
        longitude: c.lng,
        latitude: c.lat,
        zoom: (this.map.getZoom() || 0) + (this.cfg.zoomOffset || 0),
        pitch: this.cfg.pitchDeg || 0,
        bearing: 0
      };
    }

    _init() {
      if (!this.cfg.enabled) return;
      if (!this._hasDeps()) {
        this.cfg.enabled = false;
        return;
      }
      if (!this.cfg.glbUrl) {
        console.warn("🧊 Deck3D disabled: missing glbUrl");
        this.cfg.enabled = false;
        return;
      }

      this._ensureOverlay();

      this._deck = new window.deck.Deck({
        parent: this._overlay,
        controller: false,
        initialViewState: this._leafletViewState(),
        views: [new window.deck.MapView({ repeat: true })],
        layers: [],
        parameters: { depthTest: true }
      });

      const sync = () => this.syncToLeaflet();
      this.map.on("move", sync);
      this.map.on("zoom", sync);
      this.map.on("resize", sync);

      this.syncToLeaflet();
      console.log("🧊 Deck3D overlay ready");
    }

    syncToLeaflet() {
      if (!this._deck || !this.cfg.enabled) return;
      this._deck.setProps({ viewState: this._leafletViewState() });
    }

    reset() {
      this._routeVehicles.clear();
      this._render();
    }

    setRouteVehicles(routeId, vehicles, colorHex) {
      if (!this.cfg.enabled || !this._deck) return;
      this._routeVehicles.set(String(routeId), {
        vehicles: Array.isArray(vehicles) ? vehicles : [],
        colorHex: colorHex || "#0aa"
      });
      this._render();
    }

    _flattenData() {
      const out = [];
      for (const [routeId, info] of this._routeVehicles.entries()) {
        const rgb = hexToRgbArray(info.colorHex);
        for (const v of (info.vehicles || [])) {
          const lat = Number(v.lat);
          const lon = Number(v.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

          out.push({
            id: String(v.vehicleId || v.vid || v.id || `${routeId}-${lon}-${lat}`),
            routeId,
            lat,
            lon,
            bearing: Number(v.bearing ?? v.heading ?? 0) || 0,
            color: rgb
          });
        }
      }
      return out;
    }

    _render() {
      if (!this.cfg.enabled || !this._deck) return;

      const data = this._flattenData();

      if (!data.length) {
        this._deck.setProps({ layers: [] });
        return;
      }

      const layer = new window.deck.ScenegraphLayer({
        id: "buses-3d",
        data,
        scenegraph: this.cfg.glbUrl,
        sizeScale: this.cfg.sizeScale,
        pickable: false,

        getPosition: d => [d.lon, d.lat, this.cfg.elevationMeters],

        // ייתכן שתצטרך לשחק עם yawOffsetDeg כדי שהאוטובוס “יפנה קדימה”
        getOrientation: d => [0, (d.bearing + (this.cfg.yawOffsetDeg || 0)), 90],

        getColor: d => d.color
      });

      this._deck.setProps({ layers: [layer] });
    }
  }

  window.Deck3D = Deck3D;
})();