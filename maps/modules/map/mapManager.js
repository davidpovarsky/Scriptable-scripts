// modules/map/mapManager.js
// אחראי על אתחול וניהול המפה - Mapbox GL JS

class MapManager {
  constructor() {
    this.map = null;
    this.busMarkers = new Map();
    this.routeLines = new Map();
    this.userLocationMarker = null;
    this.didInitialFit = false;
    this.is3DEnabled = true;

    // ✅ חדש: שכבת GLB
    this.busModelLayer = null;
  }

  init(elementId = 'map', accessToken = null) {
    try {
      console.log("🗺️ Initializing Mapbox GL JS...");

      if (typeof mapboxgl === 'undefined') {
        throw new Error("Mapbox GL JS not loaded!");
      }

      if (accessToken) {
        mapboxgl.accessToken = accessToken;
        console.log("✅ Mapbox token set");
      } else if (window.MAPBOX_TOKEN) {
        mapboxgl.accessToken = window.MAPBOX_TOKEN;
        console.log("✅ Mapbox token from window");
      } else {
        throw new Error("No Mapbox access token provided!");
      }

      this.map = new mapboxgl.Map({
        container: elementId,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [34.78, 32.08],
        zoom: 13,
        pitch: 45,
        bearing: 0,
        antialias: true
      });

      this.map.addControl(new mapboxgl.NavigationControl({
        visualizePitch: true
      }), 'top-right');

      this.map.addControl(new mapboxgl.ScaleControl(), 'bottom-right');

      this.map.on('load', () => {
        console.log('✅ Mapbox map loaded successfully');
        this.enable3DBuildings();
        this.initializeSources();

        // ✅ חדש: הוספת שכבת GLB לכל הרכבים
        this.enableBusGLBLayer();
      });

      this.map.on('error', (e) => {
        console.error('❌ Mapbox error:', e);
      });

      console.log("✅ Mapbox initialized");
      return this.map;

    } catch (e) {
      console.error("❌ Failed to initialize Mapbox:", e);
      throw e;
    }
  }

  enable3DBuildings() {
    try {
      const layers = this.map.getStyle().layers;
      const labelLayer = layers.find(
        (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field']
      );

      this.map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 15,
          paint: {
            'fill-extrusion-color': '#aaa',
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'height']
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'min_height']
            ],
            'fill-extrusion-opacity': 0.6
          }
        },
        labelLayer ? labelLayer.id : undefined
      );

      console.log('🏢 3D buildings enabled');
    } catch (e) {
      console.error('❌ Error enabling 3D buildings:', e);
    }
  }

  // ✅ חדש: שכבת GLB
  enableBusGLBLayer() {
    try {
      if (!this.map) return;
      if (this.busModelLayer) return;

      if (typeof BusModelLayer === 'undefined') {
        console.warn("⚠️ BusModelLayer לא קיים. ודא שהקובץ modules/map/busModelLayer.js נטען ב-view.js לפני mapManager.js");
        return;
      }

      const layers = this.map.getStyle().layers || [];
      const labelLayer = layers.find(
        (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field']
      );

      this.busModelLayer = new BusModelLayer({
        id: 'bus-glb-layer',
        glbUrl: window.BUS_GLB_URL, // אם תרצה override
        // הכיוונון שלך (אפשר גם דרך window.*)
        MODEL_YAW_OFFSET_DEG: (typeof window.MODEL_YAW_OFFSET_DEG === 'number') ? window.MODEL_YAW_OFFSET_DEG : -51.75,
        MODEL_BASE_ROT_X_DEG: (typeof window.MODEL_BASE_ROT_X_DEG === 'number') ? window.MODEL_BASE_ROT_X_DEG : 88.25,
        MODEL_BASE_ROT_Y_DEG: (typeof window.MODEL_BASE_ROT_Y_DEG === 'number') ? window.MODEL_BASE_ROT_Y_DEG : 0,
        MODEL_BASE_ROT_Z_DEG: (typeof window.MODEL_BASE_ROT_Z_DEG === 'number') ? window.MODEL_BASE_ROT_Z_DEG : 0,
        OFFSET_EAST_M:  (typeof window.OFFSET_EAST_M === 'number') ? window.OFFSET_EAST_M : 0,
        OFFSET_NORTH_M: (typeof window.OFFSET_NORTH_M === 'number') ? window.OFFSET_NORTH_M : 0,
        OFFSET_UP_M:    (typeof window.OFFSET_UP_M === 'number') ? window.OFFSET_UP_M : 0,
        SCALE_MUL:      (typeof window.SCALE_MUL === 'number') ? window.SCALE_MUL : 1,
      });

      // לשים מעל buildings אבל מתחת labels
      this.map.addLayer(this.busModelLayer, labelLayer ? labelLayer.id : undefined);

      console.log("🚌 GLB bus layer added (for ALL vehicles)");
    } catch (e) {
      console.error("❌ Error enabling bus GLB layer:", e);
    }
  }

  getBusModelLayer() {
    return this.busModelLayer;
  }

  initializeSources() {
    try {
      if (!this.map.getSource('routes')) {
        this.map.addSource('routes', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });
      }

      if (!this.map.getSource('buses')) {
        this.map.addSource('buses', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });
      }

      console.log('📍 Map sources initialized');
    } catch (e) {
      console.error('❌ Error initializing sources:', e);
    }
  }

  setUserLocation(lat, lon) {
    if (!this.map) return;

    try {
      if (this.userLocationMarker) {
        this.userLocationMarker.remove();
      }

      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = `
        <div class="pulse-ring"></div>
        <div class="pulse-dot"></div>
      `;

      this.userLocationMarker = new mapboxgl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([lon, lat])
        .addTo(this.map);

      console.log('👤 User location set:', lat, lon);
    } catch (e) {
      console.error('❌ Error setting user location:', e);
    }
  }

  centerOnUser() {
    if (this.userLocationMarker && this.map) {
      const lngLat = this.userLocationMarker.getLngLat();
      this.map.flyTo({
        center: [lngLat.lng, lngLat.lat],
        zoom: 16,
        pitch: 60,
        bearing: 0,
        duration: 2000
      });
    }
  }

  clearBuses() {
    // אם יש שכבת GLB – ננקה שם
    if (this.busModelLayer && this.busModelLayer.clearAll) {
      this.busModelLayer.clearAll();
    }

    // Clear old DOM markers map (אם נשארו)
    this.busMarkers.forEach(marker => {
      if (marker && marker.remove) {
        marker.remove();
      }
    });
    this.busMarkers.clear();

    if (this.map && this.map.getSource('buses')) {
      this.map.getSource('buses').setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  }

  drawRoutePolyline(shapeCoords, color, routeId) {
    if (!this.map || !shapeCoords || !shapeCoords.length) return;

    try {
      const coordinates = shapeCoords.map(c => [c[0], c[1]]);

      const layerId = `route-${routeId}`;
      const sourceId = `route-source-${routeId}`;

      if (!this.map.getSource(sourceId)) {
        this.map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coordinates
            }
          }
        });
      }

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
            'line-color': color,
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 3,
              15, 6,
              18, 12
            ],
            'line-opacity': 0.8
          }
        });

        this.map.addLayer({
          id: `${layerId}-glow`,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': color,
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 6,
              15, 12,
              18, 20
            ],
            'line-opacity': 0.2,
            'line-blur': 4
          }
        }, layerId);
      }

      this.routeLines.set(routeId, layerId);
      console.log(`✅ Route ${routeId} drawn`);
    } catch (e) {
      console.error(`❌ Error drawing route ${routeId}:`, e);
    }
  }

  fitBoundsToShapes(allShapeCoords) {
    if (!this.map || !allShapeCoords || !allShapeCoords.length) return;
    if (this.didInitialFit) return;

    try {
      const allPoints = [];
      allShapeCoords.forEach(coords => {
        if (Array.isArray(coords)) {
          coords.forEach(c => {
            if (Array.isArray(c) && c.length === 2) {
              allPoints.push([c[0], c[1]]);
            }
          });
        }
      });

      if (allPoints.length > 1) {
        const bounds = allPoints.reduce(
          (bounds, coord) => bounds.extend(coord),
          new mapboxgl.LngLatBounds(allPoints[0], allPoints[0])
        );

        this.map.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          pitch: 45,
          duration: 2000
        });

        this.didInitialFit = true;
        console.log('✅ Bounds fitted');
      }
    } catch (e) {
      console.error('❌ Error fitting bounds:', e);
    }
  }

  invalidateSize() {
    if (this.map) {
      this.map.resize();
    }
  }

  getMap() {
    return this.map;
  }

  toggle3D() {
    this.is3DEnabled = !this.is3DEnabled;

    this.map.easeTo({
      pitch: this.is3DEnabled ? 60 : 0,
      bearing: this.is3DEnabled ? -17 : 0,
      duration: 1000
    });

    console.log(`🏗️ 3D mode: ${this.is3DEnabled ? 'ON' : 'OFF'}`);
  }

  getBearing(start, end) {
    const startLat = start[1] * Math.PI / 180;
    const startLng = start[0] * Math.PI / 180;
    const endLat = end[1] * Math.PI / 180;
    const endLng = end[0] * Math.PI / 180;

    const dLng = endLng - startLng;

    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
              Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }
}