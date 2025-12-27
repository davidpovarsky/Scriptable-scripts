// modules/map/mapManager.js
// אחראי על אתחול וניהול המפה - Mapbox GL JS עם תמיכה ב-Three.js

class MapManager {
  constructor() {
    this.map = null;
    this.busMarkers = new Map();
    this.routeLines = new Map();
    this.userLocationMarker = null;
    this.didInitialFit = false;
    this.is3DEnabled = true;
    this.customLayers = new Map();
  }

  init(elementId = 'map', accessToken = null) {
    try {
      console.log("🗺️ Initializing Mapbox GL JS...");
      
      // Check if Mapbox is available
      if (typeof mapboxgl === 'undefined') {
        throw new Error("Mapbox GL JS not loaded!");
      }

      // Set access token
      if (accessToken) {
        mapboxgl.accessToken = accessToken;
        console.log("✅ Mapbox token set");
      } else if (window.MAPBOX_TOKEN) {
        mapboxgl.accessToken = window.MAPBOX_TOKEN;
        console.log("✅ Mapbox token from window");
      } else {
        throw new Error("No Mapbox access token provided!");
      }

      // Initialize map
      this.map = new mapboxgl.Map({
        container: elementId,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [34.78, 32.08], // Tel Aviv
        zoom: 13,
        pitch: 60, // 3D tilt
        bearing: -17,
        antialias: true,
        projection: 'globe' // Modern 3D globe
      });

      // Add navigation controls
      this.map.addControl(new mapboxgl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true
      }), 'top-right');

      // Add scale control
      this.map.addControl(new mapboxgl.ScaleControl({
        maxWidth: 100,
        unit: 'metric'
      }), 'bottom-right');

      // Wait for map to load
      this.map.on('load', () => {
        console.log('✅ Mapbox map loaded successfully');
        this.enable3DBuildings();
        this.initializeSources();
        this.setupAtmosphere();
      });

      this.map.on('error', (e) => {
        console.error('❌ Mapbox error:', e);
        if (e.error && e.error.message) {
          if (e.error.message.includes('401')) {
            this.showTokenError();
          }
        }
      });

      // Map move/zoom handlers
      this.map.on('move', () => {
        // Trigger repaint for custom layers
        this.map.triggerRepaint();
      });

      this.map.on('zoom', () => {
        this.map.triggerRepaint();
      });

      console.log("✅ Mapbox initialized");
      return this.map;

    } catch (e) {
      console.error("❌ Failed to initialize Mapbox:", e);
      this.showTokenError();
      throw e;
    }
  }

  showTokenError() {
    const errorOverlay = document.getElementById('errorOverlay');
    if (errorOverlay) {
      errorOverlay.classList.add('show');
    }
  }

  setupAtmosphere() {
    // Add atmospheric effects for 3D globe
    try {
      this.map.setFog({
        'range': [0.8, 8],
        'color': '#d4e6f1',
        'horizon-blend': 0.05,
        'high-color': '#245bde',
        'space-color': '#000000',
        'star-intensity': 0.15
      });
      console.log('🌍 Atmosphere effects enabled');
    } catch (e) {
      console.warn('⚠️ Atmosphere not supported:', e);
    }
  }

  enable3DBuildings() {
    try {
      const layers = this.map.getStyle().layers;
      const labelLayerId = layers.find(
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
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'height'],
              0, '#e0e0e0',
              50, '#d0d0d0',
              100, '#c0c0c0',
              200, '#aaaaaa'
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15, 0,
              15.05, ['get', 'height']
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15, 0,
              15.05, ['get', 'min_height']
            ],
            'fill-extrusion-opacity': 0.7
          }
        },
        labelLayerId ? labelLayerId.id : undefined
      );

      console.log('🏢 3D buildings enabled');
    } catch (e) {
      console.error('❌ Error enabling 3D buildings:', e);
    }
  }

  initializeSources() {
    try {
      // Source for route polylines
      if (!this.map.getSource('routes')) {
        this.map.addSource('routes', {
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

  addCustomLayer(layerId, customLayer) {
    try {
      if (this.map.getLayer(layerId)) {
        console.warn(`⚠️ Layer ${layerId} already exists`);
        return;
      }

      this.map.addLayer(customLayer);
      this.customLayers.set(layerId, customLayer);
      console.log(`✅ Custom layer ${layerId} added`);
    } catch (e) {
      console.error(`❌ Error adding custom layer ${layerId}:`, e);
    }
  }

  removeCustomLayer(layerId) {
    try {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
        this.customLayers.delete(layerId);
        console.log(`✅ Custom layer ${layerId} removed`);
      }
    } catch (e) {
      console.error(`❌ Error removing custom layer ${layerId}:`, e);
    }
  }

  setUserLocation(lat, lon) {
    if (!this.map) return;
    
    try {
      // Remove old marker
      if (this.userLocationMarker) {
        this.userLocationMarker.remove();
      }
      
      // Create pulsing dot
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
        bearing: -17,
        duration: 2000,
        essential: true
      });
    }
  }

  drawRoutePolyline(shapeCoords, color, routeId) {
    if (!this.map || !shapeCoords || !shapeCoords.length) return;
    
    try {
      const coordinates = shapeCoords.map(c => [c[0], c[1]]);

      const layerId = `route-${routeId}`;
      const sourceId = `route-source-${routeId}`;

      // Add source
      if (!this.map.getSource(sourceId)) {
        this.map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { routeId: routeId },
            geometry: {
              type: 'LineString',
              coordinates: coordinates
            }
          },
          lineMetrics: true
        });
      }

      // Add glow layer (under)
      if (!this.map.getLayer(`${layerId}-glow`)) {
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
              ['exponential', 1.5],
              ['zoom'],
              10, 8,
              15, 16,
              18, 28
            ],
            'line-opacity': 0.15,
            'line-blur': 6
          }
        });
      }

      // Add main line layer
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
              ['exponential', 1.5],
              ['zoom'],
              10, 3,
              15, 6,
              18, 12
            ],
            'line-opacity': 0.9
          }
        });
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
          padding: { top: 80, bottom: 80, left: 80, right: 80 },
          pitch: 60,
          bearing: -17,
          duration: 2500,
          essential: true
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
      duration: 1000,
      essential: true
    });
    
    console.log(`🗺️ 3D mode: ${this.is3DEnabled ? 'ON' : 'OFF'}`);
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

  enableDebugMode() {
    // Show tile boundaries and collision boxes
    this.map.showTileBoundaries = true;
    this.map.showCollisionBoxes = true;
    console.log('🐛 Debug mode enabled');
  }

  disableDebugMode() {
    this.map.showTileBoundaries = false;
    this.map.showCollisionBoxes = false;
    console.log('🐛 Debug mode disabled');
  }
}
