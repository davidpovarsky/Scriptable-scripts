// modules/map/mapManager.js
// אחראי על אתחול וניהול המפה - עם Fallback ל-Leaflet

class MapManager {
  constructor() {
    this.map = null;
    this.busMarkers = new Map();
    this.routeLines = new Map();
    this.userLocationMarker = null;
    this.didInitialFit = false;
    this.is3DEnabled = true;
    this.mapType = null; // 'maplibre' or 'leaflet'
  }

  init(elementId = 'map') {
    try {
      console.log("🗺️ Initializing map...");
      
      // Try MapLibre first
      if (typeof maplibregl !== 'undefined') {
        return this.initMapLibre(elementId);
      } else {
        console.warn("⚠️ MapLibre not available, trying Leaflet...");
        if (typeof L !== 'undefined') {
          return this.initLeaflet(elementId);
        } else {
          throw new Error("No map library available!");
        }
      }
    } catch (e) {
      console.error("❌ Failed to initialize map:", e);
      
      // Last resort: try Leaflet
      if (typeof L !== 'undefined' && !this.map) {
        console.log("🔄 Falling back to Leaflet...");
        return this.initLeaflet(elementId);
      }
      
      throw e;
    }
  }

  initMapLibre(elementId) {
    console.log("🗺️ Initializing MapLibre GL JS...");
    this.mapType = 'maplibre';
    
    this.map = new maplibregl.Map({
      container: elementId,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [34.78, 32.08],
      zoom: 13,
      pitch: 45,
      bearing: 0,
      antialias: true
    });

    this.map.addControl(new maplibregl.NavigationControl({
      visualizePitch: true
    }), 'top-right');

    this.map.addControl(new maplibregl.ScaleControl(), 'bottom-right');

    this.map.on('load', () => {
      console.log('✅ MapLibre loaded successfully');
      this.initializeSources();
    });

    this.map.on('error', (e) => {
      console.error('❌ MapLibre error:', e);
    });

    console.log("✅ MapLibre initialized");
    return this.map;
  }

  initLeaflet(elementId) {
    console.log("🗺️ Initializing Leaflet (2D fallback)...");
    this.mapType = 'leaflet';
    
    this.map = L.map(elementId, { zoomControl: false })
      .setView([32.08, 34.78], 13);
    
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);
    
    this.busLayerGroup = L.layerGroup().addTo(this.map);
    this.busLayerGroup.setZIndex(1000);

    console.log("✅ Leaflet initialized");
    
    // Trigger load event manually for Leaflet
    setTimeout(() => {
      console.log('✅ Leaflet ready');
      if (this.map.fire) {
        this.map.fire('load');
      }
    }, 100);
    
    return this.map;
  }

  initializeSources() {
    if (this.mapType !== 'maplibre') return;
    
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
      
      if (this.mapType === 'maplibre') {
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
      } else {
        // Leaflet
        this.userLocationMarker = L.circleMarker([lat, lon], {
          radius: 8,
          color: "#1976d2",
          fillColor: "#2196f3",
          fillOpacity: 0.6
        }).addTo(this.map);
      }

      console.log('👤 User location set:', lat, lon);
    } catch (e) {
      console.error('❌ Error setting user location:', e);
    }
  }

  centerOnUser() {
    if (!this.userLocationMarker || !this.map) return;
    
    try {
      if (this.mapType === 'maplibre') {
        const lngLat = this.userLocationMarker.getLngLat();
        this.map.flyTo({
          center: [lngLat.lng, lngLat.lat],
          zoom: 16,
          pitch: 60,
          duration: 2000
        });
      } else {
        // Leaflet
        this.map.setView(this.userLocationMarker.getLatLng(), 16);
      }
    } catch (e) {
      console.error('❌ Error centering on user:', e);
    }
  }

  clearBuses() {
    try {
      this.busMarkers.forEach(marker => {
        if (marker && marker.remove) {
          marker.remove();
        }
      });
      this.busMarkers.clear();

      if (this.mapType === 'maplibre' && this.map.getSource('buses')) {
        this.map.getSource('buses').setData({
          type: 'FeatureCollection',
          features: []
        });
      } else if (this.mapType === 'leaflet' && this.busLayerGroup) {
        this.busLayerGroup.clearLayers();
      }
    } catch (e) {
      console.error('❌ Error clearing buses:', e);
    }
  }

  drawRoutePolyline(shapeCoords, color, routeId) {
    if (!this.map || !shapeCoords || !shapeCoords.length) return;
    
    try {
      if (this.mapType === 'maplibre') {
        this.drawRouteMapLibre(shapeCoords, color, routeId);
      } else {
        this.drawRouteLeaflet(shapeCoords, color, routeId);
      }
    } catch (e) {
      console.error(`❌ Error drawing route ${routeId}:`, e);
    }
  }

  drawRouteMapLibre(shapeCoords, color, routeId) {
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
    }

    this.routeLines.set(routeId, layerId);
    console.log(`✅ Route ${routeId} drawn (MapLibre)`);
  }

  drawRouteLeaflet(shapeCoords, color, routeId) {
    const latLngs = shapeCoords.map(c => [c[1], c[0]]); // Leaflet uses [lat, lon]
    
    L.polyline(latLngs, {
      color: color,
      weight: 4,
      opacity: 0.6,
      smoothFactor: 1
    }).addTo(this.map);
    
    console.log(`✅ Route ${routeId} drawn (Leaflet)`);
  }

  fitBoundsToShapes(allShapeCoords) {
    if (!this.map || !allShapeCoords || !allShapeCoords.length) return;
    if (this.didInitialFit) return;

    try {
      if (this.mapType === 'maplibre') {
        this.fitBoundsMapLibre(allShapeCoords);
      } else {
        this.fitBoundsLeaflet(allShapeCoords);
      }
      this.didInitialFit = true;
    } catch (e) {
      console.error('❌ Error fitting bounds:', e);
    }
  }

  fitBoundsMapLibre(allShapeCoords) {
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
        new maplibregl.LngLatBounds(allPoints[0], allPoints[0])
      );

      this.map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        pitch: 45,
        duration: 2000
      });
    }
  }

  fitBoundsLeaflet(allShapeCoords) {
    const allPoints = [];
    allShapeCoords.forEach(coords => {
      if (Array.isArray(coords)) {
        coords.forEach(c => {
          if (Array.isArray(c) && c.length === 2) {
            allPoints.push([c[1], c[0]]); // Leaflet: [lat, lon]
          }
        });
      }
    });

    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  invalidateSize() {
    if (this.map) {
      if (this.mapType === 'maplibre') {
        this.map.resize();
      } else {
        this.map.invalidateSize();
      }
    }
  }

  getMap() {
    return this.map;
  }

  toggle3D() {
    if (this.mapType !== 'maplibre') {
      console.warn('⚠️ 3D mode only available with MapLibre');
      return;
    }
    
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