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
        style: 'mapbox://styles/mapbox/streets-v12', // Mapbox Streets style
        center: [34.78, 32.08], // lon, lat (Tel Aviv)
        zoom: 13,
        pitch: 45, // 3D tilt
        bearing: 0,
        antialias: true
      });

      // Add navigation controls
      this.map.addControl(new mapboxgl.NavigationControl({
        visualizePitch: true
      }), 'top-right');

      // Add scale control
      this.map.addControl(new mapboxgl.ScaleControl(), 'bottom-right');

      // Wait for map to load
      this.map.on('load', () => {
        console.log('✅ Mapbox map loaded successfully');
        this.enable3DBuildings();
        this.initializeSources();
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
      // Add 3D buildings layer
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

      // Source for buses
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
      // Remove old marker
      if (this.userLocationMarker) {
        this.userLocationMarker.remove();
      }
      
      // Create pulsing dot for user location
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
    // Clear all bus markers
    this.busMarkers.forEach(marker => {
      if (marker && marker.remove) {
        marker.remove();
      }
    });
    this.busMarkers.clear();

    // Clear buses source
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
      // Convert to GeoJSON LineString
      const coordinates = shapeCoords.map(c => [c[0], c[1]]); // lon, lat

      const layerId = `route-${routeId}`;
      const sourceId = `route-source-${routeId}`;

      // Add source
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

      // Add 3D line layer
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

        // Add glow effect
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
              allPoints.push([c[0], c[1]]); // lon, lat
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