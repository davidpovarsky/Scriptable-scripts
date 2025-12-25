// view.js
// בונה HTML עם bundle מלא - גרסת Mapbox GL JS

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
        'modules/map/mapManager.js',
        'modules/map/busMarkers.js',
        'modules/map/userLocation.js',
        'modules/stops/nearbyPanel.js',
        'modules/routes/bottomSheet.js',
        'modules/routes/routeCard.js',
        'modules/ui/modeToggle.js',
        'web/app.js'
      ];
      
      // התחלת IIFE
      allJs = '(function() {\n';
      allJs += '  "use strict";\n\n';
      allJs += '  console.log("🔧 KavNav Mapbox Bundle Loading...");\n\n';
      
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

console.log("✅ KavNav Mapbox Bundle Complete");
`;
      
      // Debug output
      const debugPathLocal = fm.joinPath(baseDir, 'debug-bundle.js');
      fm.writeString(debugPathLocal, allJs);
      console.log(`📝 Debug (local): debug-bundle.js (${allJs.length} chars)`);
      
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
  <title>KavNav 3D - Mapbox</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  
  <!-- Google Fonts & Icons -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0" />
  
  <!-- Mapbox GL JS -->
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"></script>
  
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
        <div class="footer-note-global">ETA • KavNav 3D (Mapbox)</div>
      </div>
    </div>
  </div>

  <script>
    // ===== MAPBOX ACCESS TOKEN =====
    // 🔑 שים כאן את ה-API key שלך מ-Mapbox
    window.MAPBOX_TOKEN = '‏pk.eyJ1IjoiZGF2aWRwb3YiLCJhIjoiY21qbGNvMG1jMDkyZzNpcXJ6bzNwcnNtZiJ9.a2f__tImpmGUDc9ERCMXpg';
    
    window.APP_ENVIRONMENT = 'scriptable';
    console.log('🌍 Environment: Scriptable (Mapbox 3D)');
    console.log('🔑 Mapbox token configured:', window.MAPBOX_TOKEN ? 'YES' : 'NO');
  </script>
  ${isScriptable && allJs ? `<script>${allJs}</script>` : ''}
</body>
</html>`;
};