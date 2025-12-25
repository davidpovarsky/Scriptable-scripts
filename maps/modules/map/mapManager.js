// modules/map/mapManager.js
// אחראי על אתחול וניהול המפה - תלת מימד עם MapLibre GL JS

class MapManager {
  constructor() {
    this.map = null;
    this.busMarkers = new Map(); // Map of vehicleId -> marker
    this.routeLines = new Map(); // Map of routeId -> layer
    this.userLocationMarker = null;
    this.didInitialFit = false;
    this.is3DEnabled = true;
  }

  init(elementId = 'map') {
    // MapLibre GL JS initialization
    this.map = new maplibregl.Map({
      container: elementId,
      style: 'https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL', // או כל style חינמי אחר
      center: [34.78, 32.08], // lon, lat (הפוך מ-Leaflet!)
      zoom: 13,
      pitch: 45, // זווית הטיה - נותן תחושת 3D
      bearing: 0,
      antialias: true,
      attributionControl: false
    });

    // Navigation controls
    this.map.addControl(new maplibregl.NavigationControl({
      visualizePitch: true
    }), 'top-right');

    // Scale control
    this.map.addControl(new maplibregl.ScaleControl(), 'bottom-right');

    // Wait for map to load
    this.map.on('load', () => {
      console.log('🗺️ MapLibre map loaded');
      
      // Enable 3D terrain and buildings
      this.enable3DBuildings();
      
      // Add sources for routes and buses
      this.initializeSources();
    });

    return this.map;
  }

  enable3DBuildings() {
    // Add 3D buildings layer
    const layers = this.map.getStyle().layers;
    const labelLayerId = layers.find(
      (layer) => layer.type === 'symbol' && layer.layout['text-field']
    ).id;

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
      labelLayerId
    );

    console.log('🏢 3D buildings enabled');
  }

  initializeSources() {
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

    // Source for buses (will be 3D models)
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
  }

  setUserLocation(lat, lon) {
    if (!this.map) return;
    
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
    
    this.userLocationMarker = new maplibregl.Marker({
      element: el,
      anchor: 'center'
    })
      .setLngLat([lon, lat])
      .addTo(this.map);

    console.log('👤 User location set:', lat, lon);
  }

  centerOnUser() {
    if (this.userLocationMarker && this.map) {
      const lngLat = this.userLocationMarker.getLngLat();
      this.map.flyTo({
        center: [lngLat.lng, lngLat.lat],
        zoom: 16,
        pitch: 60, // תצוגה תלת מימדית
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
    if (this.map.getSource('buses')) {
      this.map.getSource('buses').setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  }

  drawRoutePolyline(shapeCoords, color, routeId) {
    if (!this.map || !shapeCoords || !shapeCoords.length) return;
    
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

    // Add 3D line layer with elevation
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
  }

  fitBoundsToShapes(allShapeCoords) {
    if (!this.map || !allShapeCoords || !allShapeCoords.length) return;
    if (this.didInitialFit) return;

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

  // Toggle 3D view
  toggle3D() {
    this.is3DEnabled = !this.is3DEnabled;
    
    this.map.easeTo({
      pitch: this.is3DEnabled ? 60 : 0,
      bearing: this.is3DEnabled ? -17 : 0,
      duration: 1000
    });
  }

  // Get bearing between two points (for bus rotation)
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
