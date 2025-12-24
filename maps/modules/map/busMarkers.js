// modules/map/busMarkers.js
// ציור אוטובוסים על המפה באמצעות deck.gl (ScenegraphLayer) עבור תלת-מימד
// ללא import/export

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.layerId = 'kavnav-buses-3d';
    this.lastBuses = [];
    this._popup = null;
  }

  // מקבל מערך של אוטובוסים כבר "מעובדים" (כולל lon/lat סופיים)
  // bus: { id, lon, lat, bearing, routeNumber, color }
  setBuses(buses) {
    this.lastBuses = Array.isArray(buses) ? buses : [];

    const modelUrl = (window && window.KAVNAV_BUS_MODEL_URL) ? window.KAVNAV_BUS_MODEL_URL : '';
    if (!modelUrl) {
      console.warn("⚠️ KAVNAV_BUS_MODEL_URL is empty. Upload/host a .glb model and set window.KAVNAV_BUS_MODEL_URL.");
      // fallback: do nothing (keeps map usable)
      this.mapManager.setDeckLayers([]);
      return;
    }

    const sizeScale = (window && window.KAVNAV_BUS_SIZE_SCALE) ? window.KAVNAV_BUS_SIZE_SCALE : 20;
    const baseScale = (window && window.KAVNAV_BUS_SCALE) ? window.KAVNAV_BUS_SCALE : 1;
    const yawOffset = (window && window.KAVNAV_BUS_YAW_OFFSET) ? window.KAVNAV_BUS_YAW_OFFSET : 0;

    const { ScenegraphLayer } = deck;

    const layer = new ScenegraphLayer({
      id: this.layerId,
      data: this.lastBuses,
      scenegraph: modelUrl,
      sizeScale,
      pickable: true,
      autoHighlight: true,

      getPosition: d => [d.lon, d.lat, 0],
      // ScenegraphLayer uses Euler angles [pitch, yaw, roll] (degrees).
      // Most glTF models face +X or +Y. Use yawOffset to calibrate once.
      getOrientation: d => [0, -(Number(d.bearing) || 0) + yawOffset, 90],
      getScale: d => [baseScale, baseScale, baseScale],
      getColor: d => hexToRgbaArray(d.color || '#1976d2', 230),

      onClick: info => {
        if (!info || !info.object || !this.mapManager || !this.mapManager.getMap) return;
        const map = this.mapManager.getMap();
        if (!map) return;

        const o = info.object;
        const html = `
          <div style="font: 13px system-ui; direction: rtl;">
            <div style="font-weight:700; margin-bottom:4px;">קו ${escapeHtml(String(o.routeNumber || ''))}</div>
            <div style="opacity:0.8;">אוטובוס בתלת־מימד</div>
          </div>
        `;

        try {
          if (this._popup) this._popup.remove();
          this._popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 12 })
            .setLngLat([o.lon, o.lat])
            .setHTML(html)
            .addTo(map);
        } catch (e) {
          console.log("Popup error:", e);
        }
      }
    });

    this.mapManager.setDeckLayers([layer]);
  }
}

// ---------- helpers ----------
function hexToRgbaArray(hex, alpha = 255) {
  const c = String(hex || '').trim();
  const m = c.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return [25, 118, 210, alpha];
  let h = m[1];
  if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return [r, g, b, alpha];
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}