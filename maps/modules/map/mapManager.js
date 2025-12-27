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
    this.busModelLayer = null; // שכבת GLB לכל הרכבים
  }

  init(elementId = 'map', accessToken = null) {
    try {
      console.log("🗺️ Initializing Mapbox GL JS...");
      
      // Set Mapbox access token
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
        bearing: -17.6,
        antialias: true // Required for 3D models
      });

      // Add navigation controls
      this.map.addControl(new mapboxgl.NavigationControl(), 'top-left');
      
      // Add scale control
      this.map.addControl(new mapboxgl.ScaleControl(), 'bottom-right');

      // Wait for map to load
      this.map.on('load', () => {
        console.log('✅ Mapbox map loaded successfully');
        this.enable3DBuildings();
        this.initializeSources();
        this.enableBusGLBLayer();
      });

      this.map.on('error', (e) => {
        console.error('❌ Mapbox error:', e);
      });

      console.log("✅ Mapbox initialized");
      
      return this.map;
    } catch (e) {
      console.error("❌ Error initializing map:", e);
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

  toggle3D() {
    try {
      this.is3DEnabled = !this.is3DEnabled;
      
      if (this.is3DEnabled) {
        this.map.easeTo({ pitch: 45, duration: 1000 });
      } else {
        this.map.easeTo({ pitch: 0, duration: 1000 });
      }
      
      console.log(this.is3DEnabled ? '🏢 3D enabled' : '🗺️ 2D enabled');
      return this.is3DEnabled;
    } catch (e) {
      console.error('❌ Error toggling 3D:', e);
      return this.is3DEnabled;
    }
  }

  initializeSources() {
    try {
      // Route lines source
      if (!this.map.getSource('routes')) {
        this.map.addSource('routes', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        // Add route lines layer
        this.map.addLayer({
          id: 'route-lines',
          type: 'line',
          source: 'routes',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 4,
            'line-opacity': 0.7
          }
        });

        console.log('✅ Route sources initialized');
      }
    } catch (e) {
      console.error('❌ Error initializing sources:', e);
    }
  }

  drawRoute(routeId, coordinates, color = '#1976d2') {
    try {
      if (!this.map || !coordinates || coordinates.length < 2) {
        return;
      }

      // Create GeoJSON feature
      const feature = {
        type: 'Feature',
        properties: {
          routeId: routeId,
          color: color
        },
        geometry: {
          type: 'LineString',
          coordinates: coordinates // [lon, lat] pairs
        }
      };

      // Update routes source data
      const source = this.map.getSource('routes');
      if (source) {
        // Get current features
        const currentData = source._data || { type: 'FeatureCollection', features: [] };
        
        // Remove existing route with same ID
        const filteredFeatures = currentData.features.filter(f => f.properties.routeId !== routeId);
        
        // Add new feature
        filteredFeatures.push(feature);
        
        // Set updated data
        source.setData({
          type: 'FeatureCollection',
          features: filteredFeatures
        });

        this.routeLines.set(routeId, feature);
        console.log(`✅ Route ${routeId} drawn`);
      }
    } catch (e) {
      console.error(`❌ Error drawing route ${routeId}:`, e);
    }
  }

  clearRoutes() {
    try {
      const source = this.map.getSource('routes');
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      this.routeLines.clear();
      console.log('🧹 Routes cleared');
    } catch (e) {
      console.error('❌ Error clearing routes:', e);
    }
  }

  fitToPoints(points) {
    try {
      if (!this.map || !points || points.length === 0) {
        return;
      }

      const bounds = points.reduce(
        (bounds, coord) => bounds.extend(coord),
        new mapboxgl.LngLatBounds(points[0], points[0])
      );

      this.map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        pitch: this.is3DEnabled ? 45 : 0,
        duration: 1000
      });
    } catch (e) {
      console.error('❌ Error fitting bounds:', e);
    }
  }

  fitToRouteAndBuses(routeId, busPositions) {
    try {
      if (this.didInitialFit) return;
      
      const routeFeature = this.routeLines.get(routeId);
      if (!routeFeature) return;

      const allPoints = [];
      
      // Add route coordinates
      if (routeFeature.geometry && routeFeature.geometry.coordinates) {
        allPoints.push(...routeFeature.geometry.coordinates);
      }
      
      // Add bus positions
      if (Array.isArray(busPositions)) {
        busPositions.forEach(pos => {
          if (pos && pos.length === 2) {
            allPoints.push(pos);
          }
        });
      }

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
        console.log('✅ Initial fit to route and buses completed');
      }
    } catch (e) {
      console.error('❌ Error fitting to route and buses:', e);
    }
  }

  setUserLocation(lon, lat) {
    try {
      if (!this.map || !isFinite(lon) || !isFinite(lat)) {
        return;
      }

      const lngLat = [lon, lat];

      if (!this.userLocationMarker) {
        // Create user location marker
        const el = document.createElement('div');
        el.className = 'user-location-marker';
        el.innerHTML = '📍';

        this.userLocationMarker = new mapboxgl.Marker(el)
          .setLngLat(lngLat)
          .addTo(this.map);

        console.log('📍 User location marker created');
      } else {
        this.userLocationMarker.setLngLat(lngLat);
      }

      return lngLat;
    } catch (e) {
      console.error('❌ Error setting user location:', e);
      return null;
    }
  }

  flyToLocation(lon, lat, zoom = 15) {
    try {
      if (!this.map || !isFinite(lon) || !isFinite(lat)) {
        return;
      }

      this.map.flyTo({
        center: [lon, lat],
        zoom: zoom,
        pitch: this.is3DEnabled ? 45 : 0,
        duration: 1500
      });

      console.log('✈️ Flying to location:', lon, lat);
    } catch (e) {
      console.error('❌ Error flying to location:', e);
    }
  }

  getMap() {
    return this.map;
  }

  // ============================================
  // Bus GLB Layer (Three.js Custom Layer)
  // ============================================
  enableBusGLBLayer() {
    try {
      if (!this.map) return;
      if (typeof THREE === 'undefined') {
        console.warn("⚠️ THREE לא נטען - שכבת GLB לא תופעל (בדוק view.js)");
        return;
      }
      if (typeof BusModelLayer === 'undefined') {
        console.warn("⚠️ BusModelLayer לא קיים - בדוק שהקובץ modules/map/busModelLayer.js נטען לפני mapManager.js");
        return;
      }

      if (!this.busModelLayer) {
        this.busModelLayer = new BusModelLayer(this.map);
      }
      this.busModelLayer.addToMap();
    } catch (e) {
      console.error("❌ Error enabling Bus GLB Layer:", e);
    }
  }

  getBusModelLayer() {
    return this.busModelLayer;
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