// modules/map/mapManager.js
// אחראי על אתחול וניהול המפה (MapLibre) + אינטגרציה ל-deck.gl
// ללא import/export

class MapManager {
  constructor() {
    this.map = null;              // maplibregl.Map
    this.deckOverlay = null;      // deck.MapboxOverlay
    this.userMarker = null;       // maplibregl.Marker
    this.userLngLat = null;       // [lng, lat]
    this.didInitialFit = false;

    this._isLoaded = false;
    this._readyQueue = [];
    this._routeLayerIds = new Set();
  }

  init(elementId = 'map') {
    if (typeof maplibregl === 'undefined') {
      console.error("❌ MapLibre not loaded (maplibregl is undefined)");
      return null;
    }
    if (typeof deck === 'undefined') {
      console.error("❌ deck.gl not loaded (deck is undefined)");
      return null;
    }

    const styleUrl = (window && window.KAVNAV_MAP_STYLE_URL)
      ? window.KAVNAV_MAP_STYLE_URL
      : 'https://tiles.openfreemap.org/styles/liberty';

    this.map = new maplibregl.Map({
      container: elementId,
      style: styleUrl,
      center: [34.78, 32.08],
      zoom: 13,
      attributionControl: false,
      preserveDrawingBuffer: false
    });

    // Leaflet-compat shims (for older modules that might still call leaflet-style methods)
    // (לא חובה להשתמש בזה, אבל זה מצמצם שבירות בקוד ישן)
    try {
      this.map.invalidateSize = this.map.resize.bind(this.map);
      this.map.setView = (latlng, zoom) => {
        if (!latlng) return;
        const lat = Array.isArray(latlng) ? latlng[0] : latlng.lat;
        const lon = Array.isArray(latlng) ? latlng[1] : latlng.lng;
        this.map.easeTo({ center: [lon, lat], zoom: (zoom ?? this.map.getZoom()), duration: 0 });
      };
    } catch (_) {}

    // Controls
    try {
      this.map.addControl(
        new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
        'top-right'
      );
      this.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    } catch (e) {
      console.log("⚠️ MapLibre controls init failed:", e);
    }

    // deck.gl overlay (overlaid mode = most compatible)
    try {
      const { MapboxOverlay } = deck;
      this.deckOverlay = new MapboxOverlay({
        interleaved: false,
        layers: []
      });
      this.map.addControl(this.deckOverlay);
    } catch (e) {
      console.error("❌ Failed creating deck overlay:", e);
      this.deckOverlay = null;
    }

    this.map.on('load', () => {
      this._isLoaded = true;
      this._flushReadyQueue();
      console.log("🗺️ MapLibre loaded");
      if (window && window.KAVNAV_ENABLE_3D_BUILDINGS) {
        this.enable3DBuildings();
      }
    });

    return this.map;
  }

  // ---------- internal ready helpers ----------
  _onReady(fn) {
    if (this._isLoaded) {
      try { fn(); } catch (e) { console.error("Ready fn error:", e); }
    } else {
      this._readyQueue.push(fn);
    }
  }

  _flushReadyQueue() {
    const q = this._readyQueue.slice();
    this._readyQueue.length = 0;
    q.forEach(fn => {
      try { fn(); } catch (e) { console.error("Queued fn error:", e); }
    });
  }

  // ---------- user location ----------
  setUserLocation(lat, lon) {
    if (!this.map) return;
    const lngLat = [lon, lat];
    this.userLngLat = lngLat;

    this._onReady(() => {
      // remove previous
      if (this.userMarker) {
        try { this.userMarker.remove(); } catch (_) {}
        this.userMarker = null;
      }

      const el = document.createElement('div');
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.background = '#2196f3';
      el.style.border = '2px solid #ffffff';
      el.style.boxShadow = '0 0 0 2px rgba(33,150,243,0.25)';

      this.userMarker = new maplibregl.Marker({ element: el })
        .setLngLat(lngLat)
        .addTo(this.map);
    });
  }

  centerOnUser() {
    if (!this.map || !this.userLngLat) return;
    this._onReady(() => {
      this.map.easeTo({ center: this.userLngLat, zoom: 16, duration: 400 });
    });
  }

  // ---------- buses (deck layers) ----------
  clearBuses() {
    if (!this.deckOverlay) return;
    this._onReady(() => {
      this.deckOverlay.setProps({ layers: [] });
    });
  }

  setDeckLayers(layersArray) {
    if (!this.deckOverlay) return;
    this._onReady(() => {
      this.deckOverlay.setProps({ layers: Array.isArray(layersArray) ? layersArray : [] });
    });
  }

  // ---------- routes ----------
  drawRoutePolyline(routeId, shapeCoords, color) {
    if (!this.map || !shapeCoords || !shapeCoords.length) return;
    const id = `route-${routeId}`;

    // GeoJSON feature
    const geojson = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: shapeCoords.map(c => [c[0], c[1]]) // [lon, lat]
        },
        properties: {}
      }]
    };

    this._onReady(() => {
      const sourceId = `${id}-src`;
      const layerId = `${id}-line`;

      // upsert source
      if (this.map.getSource(sourceId)) {
        this.map.getSource(sourceId).setData(geojson);
      } else {
        this.map.addSource(sourceId, { type: 'geojson', data: geojson });
      }

      // upsert layer
      if (!this.map.getLayer(layerId)) {
        this.map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': color || '#1976d2',
            'line-width': 4,
            'line-opacity': 0.6
          }
        });
        this._routeLayerIds.add(layerId);
      } else {
        // update color if needed
        try {
          this.map.setPaintProperty(layerId, 'line-color', color || '#1976d2');
        } catch (_) {}
      }
    });
  }

  fitBoundsToShapes(allShapeCoords) {
    if (!this.map || !allShapeCoords || !allShapeCoords.length) return;
    if (this.didInitialFit) return;

    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (const coords of allShapeCoords) {
      if (!Array.isArray(coords)) continue;
      for (const c of coords) {
        if (!Array.isArray(c) || c.length < 2) continue;
        const lon = c[0], lat = c[1];
        if (typeof lon !== 'number' || typeof lat !== 'number') continue;
        minLon = Math.min(minLon, lon);
        minLat = Math.min(minLat, lat);
        maxLon = Math.max(maxLon, lon);
        maxLat = Math.max(maxLat, lat);
      }
    }

    if (!isFinite(minLon) || !isFinite(minLat) || !isFinite(maxLon) || !isFinite(maxLat)) return;

    this._onReady(() => {
      this.map.fitBounds([[minLon, minLat], [maxLon, maxLat]], {
        padding: 50,
        duration: 0
      });
      this.didInitialFit = true;
    });
  }

  // ---------- 3D buildings (optional) ----------
  enable3DBuildings() {
    if (!this.map || !this._isLoaded) return;

    try {
      const style = this.map.getStyle();
      const layers = (style && style.layers) ? style.layers : [];

      // find label layer to insert below (so buildings don't cover labels)
      let labelLayerId = null;
      for (const l of layers) {
        if (l.type === 'symbol' && l.layout && l.layout['text-field']) {
          labelLayerId = l.id;
          break;
        }
      }

      // find a layer that references building source-layer so we can reuse its source
      let buildingRef = layers.find(l => (l['source-layer'] && String(l['source-layer']).toLowerCase().includes('building')) && l.source);
      if (!buildingRef) buildingRef = layers.find(l => String(l.id).toLowerCase().includes('building') && l.source);

      if (!buildingRef) {
        console.log("🏙️ 3D buildings: no building layer found in style");
        return;
      }

      const source = buildingRef.source;
      const sourceLayer = buildingRef['source-layer'];

      // Avoid duplicate
      if (this.map.getLayer('kavnav-3d-buildings')) return;

      this.map.addLayer({
        id: 'kavnav-3d-buildings',
        type: 'fill-extrusion',
        source,
        ...(sourceLayer ? { 'source-layer': sourceLayer } : {}),
        minzoom: 14,
        paint: {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-opacity': 0.55,
          'fill-extrusion-height': [
            'coalesce',
            ['get', 'render_height'],
            ['get', 'height'],
            0
          ],
          'fill-extrusion-base': [
            'coalesce',
            ['get', 'render_min_height'],
            ['get', 'min_height'],
            0
          ]
        }
      }, labelLayerId || undefined);

      console.log("🏙️ 3D buildings enabled");
    } catch (e) {
      console.log("🏙️ 3D buildings failed:", e);
    }
  }

  // ---------- misc ----------
  invalidateSize() {
    if (this.map) {
      this._onReady(() => this.map.resize());
    }
  }

  getMap() {
    return this.map;
  }
}