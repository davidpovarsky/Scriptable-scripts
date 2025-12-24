// view.js
// בונה HTML עם bundle מלא - תיקון סופי

module.exports.getHtml = function() {
  const isScriptable = typeof FileManager !== 'undefined';
  
  let allCss = '';
  let allJs = '';
  
  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const baseDir = fm.documentsDirectory();
      
      console.log("🔧 Building modular bundle...");
      
      // CSS
      const cssFiles = ['styles/base.css', 'styles/map.css', 'styles/stops.css', 'styles/routes.css'];
      cssFiles.forEach(f => {
        const p = fm.joinPath(baseDir, f);
        if (fm.fileExists(p)) allCss += fm.readString(p) + '\n';
      });
      
      // JS - בסדר הנכון!
      const jsFiles = [
        'modules/ui/utils.js',
        'modules/map/mapManager.js',
        'modules/map/deck3d.js',
        'modules/map/busMarkers.js',
        'modules/map/userLocation.js',
        'modules/stops/nearbyPanel.js',
        'modules/routes/bottomSheet.js',
        'modules/routes/routeCard.js',
        'modules/ui/modeToggle.js',
        'web/app.js'
      ];
      
      // התחלת IIFE
      allJs = '(function() {\\n';
      allJs += '  "use strict";\\n\\n';
      allJs += '  console.log("🔧 KavNav Bundle Loading...");\\n\\n';
      
      jsFiles.forEach((file) => {
        const path = fm.joinPath(baseDir, file);
        if (fm.fileExists(path)) {
          let code = fm.readString(path);
          allJs += `\\n// ===== ${file} =====\\n`;
          allJs += code + '\\n';
        } else {
          allJs += `\\nconsole.warn("Missing file: ${file}");\\n`;
        }
      });
      
      allJs += '\\n})();\\n';
      
    } catch (e) {
      console.error("Bundle build failed:", e);
      allJs = 'console.error("Bundle build failed");';
    }
  }

  return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>KavNav</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2...Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
  <!-- deck.gl (for 3D buses) -->
  <script src="https://unpkg.com/deck.gl@8.9.36/dist.min.js"></script>
  <script src="https://unpkg.com/@deck.gl/mesh-layers@8.9.36/dist.min.js"></script>
  ${isScriptable && allCss ? `<style>${allCss}

  /* deck.gl overlay */
  #map { position: relative; }
  #deckOverlay { position:absolute; inset:0; pointer-events:none; z-index:500; }
  </style>` : ''}
</head>
<body class="mode-map-only">
  <div id="modeToggleContainer">
    <div class="mode-toggle">
      <input type="radio" name="viewMode" id="modeDual" value="dual">
      <label for="modeDual">תצוגה כפולה</label>
      <input type="radio" name="viewMode" id="modeMap" value="map" checked>
      <label for="modeMap">מפה בלבד</label>
      <input type="radio" name="viewMode" id="modeStops" value="stops">
      <label for="modeStops">תחנות בלבד</label>
    </div>
  </div>

  <div id="appContainer">
    <div id="mapContainer">
      <div id="map"></div>
    </div>
    <div id="stopsContainer">
      <div id="nearbyPanel"></div>
    </div>
  </div>

  <div id="bottomSheet"></div>

  <script>
    ${isScriptable ? allJs : ''}
  </script>
</body>
</html>
  `;
};