// view.js - builds HTML with inlined CSS/JS for Scriptable WebView

module.exports.getHtml = function() {
  const isScriptable = typeof FileManager !== 'undefined';
  
  let allCss = '';
  let allJs = '';
  
  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const baseDir = fm.documentsDirectory();
      
      console.log("🔧 Building modular bundle.....");
      
      // ===== CSS =====
      const cssFiles = [
        'styles/base.css',
        'styles/map.css',
        'styles/stops.css',
        'styles/routes.css'
      ];
      
      cssFiles.forEach(f => {
        const p = fm.joinPath(baseDir, f);
        if (fm.fileExists(p)) allCss += fm.readString(p) + '\n';
        else console.warn("⚠️ Missing CSS file:", f);
      });
      
      // ===== JS =====
      const jsFiles = [
        'modules/ui/utils.js',
        'modules/map/mapManager.js',
        'modules/map/busMarkers.js',
        'modules/map/userLocation.js',
        'modules/stops/nearbyPanel.js',
        'modules/routes/bottomSheet.js',
        'modules/routes/routeCard.js',
        'modules/ui/modeToggle.js',
        'web/app.js'
      ];
      
      jsFiles.forEach(file => {
        const p = fm.joinPath(baseDir, file);
        if (!fm.fileExists(p)) {
          console.warn("⚠️ Missing JS file:", file);
          return;
        }
        
        let content = fm.readString(p);
        
        // Clean up module.exports / export stuff for browser runtime
        content = content
          .replace(/module\\.exports\\s*=\\s*/g, '')
          .replace(/export\\s+default\\s+/g, '')
          .replace(/export\\s+/g, '');

        // Ensure web/app.js stays compatible
        if (file === 'web/app.js') {
          content = content.replace(/module\\.exports\\./g, 'window.');
        }
        
        allJs += `\\n// ===== ${file} =====\\n` + content + '\\n';
      });
      
    } catch(e) {
      console.error("❌ Failed building HTML bundle:", e);
    }
  }

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KavNav</title>

  ${allCss ? `<style>${allCss}</style>` : ''}

  <!-- MapLibre GL (WebGL vector map) -->
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.15.0/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@5.15.0/dist/maplibre-gl.js"></script>

  <!-- deck.gl (Standalone bundle: MapboxOverlay + layers like ScenegraphLayer) -->
  <script src="https://unpkg.com/deck.gl@^9.0.0/dist.min.js"></script>

  <style>
    /* Keep custom UI above map canvases (MapLibre + deck overlay) */
    #map { position: relative; }
    #locateMeBtn { position: absolute; z-index: 9999; }
    /* If you ever use MapLibre popups, ensure they render above deck canvas */
    .maplibregl-popup { z-index: 10000; }
  </style>
</head>

<body>
  <div class="app-root">
    <div id="modeToggleContainer"></div>

    <div class="pane-stops">
      <div class="pane-header">תחנות קרובות</div>
      <div id="nearbyStopsList">
        <div style="padding:20px; text-align:center; color:#888;">טוען תחנות...</div>
      </div>
    </div>

    <div class="pane-map-wrapper">
      <div id="map">
        <button id="locateMeBtn" title="המיקום שלי">📍</button>
      </div>
      <div id="bottomSheet">
        <div id="dragHandleArea"><div class="handle-bar"></div></div>
        <div id="routesContainer"></div>
        <div class="footer-note-global">ETA • KavNav</div>
      </div>
    </div>
  </div>

 <script>
  window.APP_ENVIRONMENT = 'scriptable';

  // ✅ מודל 3D של האוטובוס (GLB)
  window.KAVNAV_BUS_MODEL_URL =
    "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/deckgl-3d/maps/Bus4glb.glb";

  // כיוונון (תתחיל כך, נשנה אחרי צילום מסך אם צריך)
  window.KAVNAV_BUS_SIZE_SCALE = 30; // תנסה 10–80
  window.KAVNAV_BUS_SCALE = 1;       // תנסה 0.5–3
  window.KAVNAV_BUS_YAW_OFFSET = 0;  // אם האוטובוס “מסתכל הצידה”: 90/180/-90
</script>

  ${isScriptable && allJs ? `<script>${allJs}</script>` : ''}
</body>
</html>`;
};