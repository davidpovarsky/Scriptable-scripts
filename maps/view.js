// view.js
// בונה HTML עם bundle מלא

module.exports.getHtml = function() {
  const isScriptable = typeof FileManager !== 'undefined';

  let allCss = '';
  let allJs = '';

  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const baseDir = fm.documentsDirectory();

      console.log("🔧 Building modular bundle with Mapbox 3D...");

      // ===== CSS =====
      const cssFiles = [
        'styles/base.css',
        'styles/map.css',
        'styles/stops.css',
        'styles/routes.css'
      ];

      cssFiles.forEach(f => {
        const p = fm.joinPath(baseDir, f);
        if (fm.fileExists(p)) {
          allCss += fm.readString(p) + '\n';
          console.log(`✅ CSS: ${f}`);
        }
      });

      // ===== JS =====
      const jsFiles = [
        'modules/ui/utils.js',

        // ✅ חייב לפני mapManager
        'modules/map/busModelLayer.js',

        'modules/map/mapManager.js',
        'modules/map/busMarkers.js',
        'modules/map/userLocation.js',
        'modules/stops/nearbyPanel.js',
        'modules/routes/bottomSheet.js',
        'modules/routes/routeCard.js',
        'modules/ui/modeToggle.js',
        'web/app.js'
      ];

      allJs = '(function() {\n';
      allJs += '  "use strict";\n\n';
      allJs += '  console.log("🔧 KavNav Bundle Loading...");\n\n';

      jsFiles.forEach((file) => {
        const path = fm.joinPath(baseDir, file);
        if (fm.fileExists(path)) {
          let code = fm.readString(path);

          code = code
            .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, '')
            .replace(/^import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
            .replace(/^export\s+(class|function|const|let|var)\s+/gm, '$1 ')
            .replace(/^export\s+default\s+/gm, '')
            .replace(/^export\s+\{[^}]+\};?\s*$/gm, '')
            .replace(/\n{3,}/g, '\n\n');

          allJs += `  // ===== ${file} =====\n`;
          allJs += code.split('\n').map(line => '  ' + line).join('\n');
          allJs += '\n\n';

          console.log(`✅ JS: ${file}`);
        } else {
          console.log(`⚠️ Missing: ${file}`);
        }
      });

      allJs += `
  // ===== Auto-init =====
  (function boot() {
    const start = async () => {
      try {
        if (typeof initApp === 'function') await initApp();
        else console.error("❌ initApp not found");
      } catch (e) {
        console.error("❌ initApp error:", e);
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  })();
})();\n`;

      console.log("✅ Bundle built successfully");
    } catch (e) {
      console.error("❌ Error building bundle:", e);
    }
  }

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>KavNav 3D</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

  <!-- Mapbox GL JS -->
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"></script>

  <!-- ✅ Three.js + GLTFLoader (GLOBAL, עובד בוובוויו) -->
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>

  <style>
    ${allCss}
  </style>
</head>
<body class="mode-map-only">
  <div class="main-split-container">
    <div class="pane-nearby">
      <div class="nearby-header">תחנות קרובות</div>
      <div id="nearbyStopsList" class="nearby-list">
        <div style="padding:20px; text-align:center; color:#888;">טוען תחנות...</div>
      </div>
    </div>

    <div class="pane-map-wrapper">
      <div id="map">
        <button id="locateMeBtn" title="המיקום שלי">📍</button>
        <button id="toggle3DBtn" title="מעבר בין 2D ל-3D" class="active">🏗️</button>
      </div>

      <div id="bottomSheet">
        <div id="dragHandleArea"><div class="handle-bar"></div></div>
        <div id="routesContainer"></div>
        <div class="footer-note-global">ETA • KavNav 3D</div>
      </div>
    </div>
  </div>

  <script>
    // ✅ השאר את הטוקן שלך כמו אצלך (הוא כבר עובד כי המפה נטענת)
    // window.MAPBOX_TOKEN = 'YOUR_TOKEN_HERE';

    // GLB defaults
    window.BUS_GLB_URL = "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb";

    // הכיוונון שלך:
    window.MODEL_YAW_OFFSET_DEG = -51.75;
    window.MODEL_BASE_ROT_X_DEG = 88.25;
    window.MODEL_BASE_ROT_Y_DEG = 0;
    window.MODEL_BASE_ROT_Z_DEG = 0;

    window.OFFSET_EAST_M  = 0;
    window.OFFSET_NORTH_M = 0;
    window.OFFSET_UP_M    = 0;
    window.SCALE_MUL      = 1;

    console.log("✅ Preload check:",
      "THREE?", typeof THREE !== 'undefined',
      "THREE.GLTFLoader?", (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader !== 'undefined'),
      "GLTFLoader global?", (typeof GLTFLoader !== 'undefined')
    );
  </script>

  <script>
    ${allJs}
  </script>
</body>
</html>`;
};