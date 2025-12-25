// modules/map/mapManager.js
// אחראי על אתחול וניהול המפה - תלת מימד עם MapLibre GL JS

class MapManager {
  constructor() {
    this.map = null;
    this.busMarkers = new Map();
    this.routeLines = new Map();
    this.userLocationMarker = null;
    this.didInitialFit = false;
    this.is3DEnabled = true;
  }

  init(elementId = 'map') {
    console.log('🗺️ Initializing MapLibre map...');
    
    // Check if maplibregl is loaded
    if (typeof maplibregl === 'undefined') {
      console.error('❌ MapLibre GL JS not loaded!');
      alert('שגיאה: ספריית המפות לא נטענה. בדוק חיבור אינטרנט.');
      return null;
    }
    
    try {
      // MapLibre GL JS initialization with free OSM style
      this.map = new maplibregl.Map({
        container: elementId,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors'
            }
          },
          layers: [{
            id: 'osm',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19
          }]
        },
        center: [34.78, 32.08], // lon, lat
        zoom: 13,
        pitch: 45,
        bearing: 0,
        antialias: true
      });

      // Navigation controls
      this.map.addControl(new maplibregl.NavigationControl({
        visualizePitch: true
      }), 'top-right');

      // Scale control
      this.map.addControl(new maplibregl.ScaleControl(), 'bottom-right');

      // Wait for map to load
      this.map.on('load', () => {
        console.log('✅ MapLibre map loaded successfully');
        this.initializeSources();
      });

      // Error handling
      this.map.on('error', (e) => {
        console.error('Map error:', e);
      });

      return this.map;
      
    } catch (e) {
      console.error('❌ Failed to initialize map:', e);
      alert('שגיאה באתחול המפה: ' + e.message);
      return null;
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
      console.error('Failed to initialize sources:', e);
    }
  }

  setUserLocation(lat, lon) {
    if (!this.map) return;
    
    console.log('Setting user location:', lat, lon);
    
    // Remove old marker
    if (this.userLocationMarker) {
      this.userLocationMarker.remove();
    }
    
    try {
      // Create pulsing dot
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = `
        <div class="pulse-ring"></div>
        <div class="pulse-dot"></div>
      `;
      
      this.userLocationMarker = new maplibregl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([lon, lat])
        .addTo(this.map);

      console.log('✅ User location marker added');
    } catch (e) {
      console.error('Failed to set user location:', e);
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
    
    console.log(`Drawing route ${routeId} with ${shapeCoords.length} points`);
    
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

      // Add line layer
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
      console.error(`Failed to draw route ${routeId}:`, e);
    }
  }

  fitBoundsToShapes(allShapeCoords) {
    if (!this.map || !allShapeCoords || !allShapeCoords.length) return;
    if (this.didInitialFit) return;

    console.log('Fitting bounds to shapes...');

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
          new maplibregl.LngLatBounds(allPoints[0], allPoints[0])
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
      console.error('Failed to fit bounds:', e);
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