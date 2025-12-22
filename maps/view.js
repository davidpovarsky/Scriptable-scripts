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

      // ===== CSS =====
      const cssFiles = [
        'styles/base.css',
        'styles/map.css',
        'styles/stops.css',
        'styles/routes.css',
        'styles/stopsPanel.css'
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
        'modules/map/mapManager.js',
        'modules/map/busMarkers.js',
        'modules/map/userLocation.js',

        // Stops panel חדש (במקום nearbyPanel)
        'modules/stops/kavnavStopsPanel.js',

        'modules/routes/bottomSheet.js',
        'modules/routes/routeCard.js',
        'modules/ui/modeToggle.js',
        'web/app.js'
      ];

      // התחלת IIFE
      allJs = '(function() {\n';
      allJs += '  "use strict";\n\n';
      allJs += '  console.log("🔧 KavNav Bundle Loading...");\n\n';

      jsFiles.forEach((file) => {
        const path = fm.joinPath(baseDir, file);
        if (fm.fileExists(path)) {
          let code = fm.readString(path);

          // ניקוי imports/exports
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

      // סגירת IIFE + קריאה לאתחול
      allJs += `
  // ===== Auto-initialization =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async function() {
      console.log("📋 DOM loaded via event");
      await initApp();
    });
  } else {
    console.log("📋 DOM already ready");
    initApp().catch(e => console.error("Init error:", e));
  }

})();

console.log("✅ KavNav Bundle Complete");
`;

      // Debug output - שמירה גם ב-Local וגם ב-iCloud
      const debugPathLocal = fm.joinPath(baseDir, 'debug-bundle.js');
      fm.writeString(debugPathLocal, allJs);
      console.log(`📝 Debug (local): debug-bundle.js (${allJs.length} chars)`);

      // שמירה נוספת ב-iCloud
      try {
        const fmCloud = FileManager.iCloud();
        const debugPathCloud = fmCloud.joinPath(fmCloud.documentsDirectory(), 'debug-bundle.js');
        fmCloud.writeString(debugPathCloud, allJs);
        console.log(`📝 Debug (iCloud): debug-bundle.js saved`);
      } catch (e) {
        console.log(`⚠️ iCloud save failed: ${e}`);
      }

    } catch (e) {
      console.error('❌ Bundle error:', e);
    }
  }

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>KavNav</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
  ${isScriptable && allCss ? `<style>${allCss}</style>` : ''}
</head>
<body class="mode-map-only">
  <div id="modeToggleContainer">
    <div class="mode-toggle">
      <input type="radio" name="viewMode" id="modeDual" value="dual">
      <label for="modeDual">תצוגה כפולה</label>
      <input type="radio" name="viewMode" id="modeMap" value="map" checked>
      <label for="modeMap">מפה בלבד</label>
      <div class="toggle-bg"></div>
    </div>
  </div>

  <div class="main-split-container">
    <div class="pane-nearby">
      <!-- ===== Stops Panel (Project2 UI) ===== -->
      <div id="stopsPanelRoot" class="kavnav-stops-panel-root">
        <div id="search-overlay" class="search-overlay"></div>

        <div id="search-container" class="search-container">
          <input id="search-input" type="text" placeholder="חפש בתחנות הקרובות…" autocomplete="off" />
          <button id="search-btn" type="button" title="חיפוש">🔍</button>
          <div id="search-results" class="search-results"></div>
        </div>

        <div id="connection-status" class="connection-status hidden"></div>

        <header class="kavnav-stops-header">
          <button id="refresh-btn" type="button" title="רענון">⟳</button>
          <div id="scroll-area" class="scroll-area"></div>
        </header>

        <div id="content"></div>
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

  <script>window.APP_ENVIRONMENT = 'scriptable';</script>
  ${isScriptable && allJs ? `<script>${allJs}</script>` : ''}
</body>
</html>`;
};
