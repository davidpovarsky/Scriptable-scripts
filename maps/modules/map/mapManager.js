// modules/map/mapManager.js
// ניהול המפה והוספת השכבה התלת מימדית החדשה

class MapManager {
  constructor() {
    this.map = null;
    this.busLayer = null; // BusMarkers instance
    this.routeLines = new Map();
    this.userLocationMarker = null;
    this.is3DEnabled = true;
  }

  init(elementId = 'map', accessToken = null) {
    console.log("🗺️ Initializing Mapbox GL JS...");
    
    if (accessToken) mapboxgl.accessToken = accessToken;
    else if (window.MAPBOX_TOKEN) mapboxgl.accessToken = window.MAPBOX_TOKEN;
    
    // מפה עם סטייל Dark שמתאים יותר למודלים תלת מימדיים (אופציונלי, אפשר לשנות)
    this.map = new mapboxgl.Map({
      container: elementId,
      style: 'mapbox://styles/mapbox/dark-v11', 
      center: [34.78, 32.08],
      zoom: 13,
      pitch: 60,
      bearing: 0,
      antialias: true // חובה עבור Three.js
    });

    this.map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }));

    this.map.on('load', () => {
      console.log('✅ Mapbox map loaded');
      this.enable3DBuildings();
      this.initializeSources();
      
      // אתחול שכבת האוטובוסים התלת מימדית
      this.busLayer = new BusMarkers(this);
      
      // הוספת השכבה למפה
      // אנחנו מוסיפים אותה אחרי הבניינים כדי שהאוטובוסים יופיעו ביניהם
      if (this.map.getLayer('3d-buildings')) {
          this.map.addLayer(this.busLayer, '3d-buildings');
      } else {
          this.map.addLayer(this.busLayer);
      }
    });

    return this.map;
  }
  
  initializeSources() {
      // מקורות למסלולים
      if (!this.map.getSource('routes')) {
        this.map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
  }

  drawRoutePolyline(shapeCoords, color, routeId) {
    if (!this.map || !shapeCoords || !shapeCoords.length) return;
    
    const layerId = `route-${routeId}`;
    const sourceId = `source-${routeId}`;
    
    // המרה ל-GeoJSON
    const geojson = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: shapeCoords.map(c => [c[0], c[1]]) }
    };

    if (!this.map.getSource(sourceId)) {
      this.map.addSource(sourceId, { type: 'geojson', data: geojson });
      
      // קו רגיל
      this.map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 
            'line-color': color, 
            'line-width': 5,
            'line-opacity': 0.8
        }
      });
      
      // אפקט זוהר
      this.map.addLayer({
        id: layerId + '-glow',
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
             'line-color': color,
             'line-width': 12,
             'line-opacity': 0.3,
             'line-blur': 4
        }
      }, layerId);
    }
    this.routeLines.set(routeId, layerId);
  }

  fitBoundsToShapes(allShapeCoords) {
    if(!this.map || !allShapeCoords.length) return;
    
    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;
    
    allShapeCoords.forEach(coords => {
        if(Array.isArray(coords)) {
            coords.forEach(c => {
                if(c && c.length >= 2) {
                    bounds.extend([c[0], c[1]]);
                    hasPoints = true;
                }
            });
        }
    });
    
    if(hasPoints) {
        this.map.fitBounds(bounds, { padding: 60, pitch: 45, duration: 2000 });
    }
  }

  enable3DBuildings() {
    const layers = this.map.getStyle().layers;
    const labelLayerId = layers.find(l => l.type === 'symbol' && l.layout['text-field'])?.id;
    
    if (!this.map.getLayer('3d-buildings')) {
        this.map.addLayer({
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
                'fill-extrusion-color': '#222',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-opacity': 0.8
            }
        }, labelLayerId);
    }
  }

  setUserLocation(lat, lon) {
    if (this.userLocationMarker) this.userLocationMarker.remove();
    
    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.innerHTML = '<div class="pulse-ring"></div><div class="pulse-dot"></div>';
    
    this.userLocationMarker = new mapboxgl.Marker(el)
        .setLngLat([lon, lat])
        .addTo(this.map);
        
    this.map.flyTo({ center: [lon, lat], zoom: 15 });
  }

  toggle3D() {
    this.is3DEnabled = !this.is3DEnabled;
    this.map.easeTo({ pitch: this.is3DEnabled ? 60 : 0, duration: 1000 });
  }
  
  getBusLayer() { return this.busLayer; }
}
