// view.js
// גרסה מתוקנת - ללא IIFE כדי ש-window functions יהיו נגישים!

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
        if (fm.fileExists(p)) {
          allCss += fm.readString(p) + '\n';
          console.log(`✅ CSS: ${f}`);
        }
      });
      
      // JS - בסדר הנכון, ללא IIFE!
      const jsFiles = [
        'modules/ui/utils.js',          // 1. getVariedColor, fetchJson
        'modules/map/mapManager.js',    // 2. MapManager class
        'modules/map/busMarkers.js',    // 3. BusMarkers class  
        'modules/map/userLocation.js',  // 4. UserLocationManager class
        'modules/stops/nearbyPanel.js', // 5. NearbyPanel class
        'modules/routes/bottomSheet.js',// 6. BottomSheet class
        'modules/routes/routeCard.js',  // 7. RouteCard class
        'modules/ui/modeToggle.js',     // 8. ModeToggle class
        'web/app.js'                    // 9. window.initStaticData, etc
      ];
      
      // בניית הקוד - ללא IIFE!
      allJs = `// KavNav Modular Bundle (No IIFE)\nconsole.log("🔧 Loading KavNav modular bundle...");\n\n`;
      
      jsFiles.forEach((file, idx) => {
        const path = fm.joinPath(baseDir, file);
        if (fm.fileExists(path)) {
          let code = fm.readString(path);
          
          // ניקוי imports/exports
          code = code
            .replace(/export\s+class\s+/g, 'class ')
            .replace(/export\s+function\s+/g, 'function ')
            .replace(/export\s+const\s+/g, 'const ')
            .replace(/export\s+let\s+/g, 'let ')
            .replace(/export\s+var\s+/g, 'var ')
            .replace(/export\s+\{[^}]+\}/g, '')
            .replace(/export\s+default\s+/g, '')
            .replace(/import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"]\s*;?\s*/g, '')
            .replace(/import\s+[^\n]+\n/g, '');
          
          allJs += `// ===== ${idx + 1}. ${file} =====\n`;
          allJs += code + '\n\n';
          
          console.log(`✅ JS: ${file} (${code.length} chars)`);
        } else {
          console.error(`❌ Missing: ${file}`);
        }
      });
      
      allJs += `console.log("✅ KavNav modular bundle loaded");\n`;
      allJs += `console.log("🔍 Available window functions:", Object.keys(window).filter(k => k.startsWith('init') || k.startsWith('update') || k.startsWith('set')));\n`;
      
      // שמירת debug
      const debugPath = fm.joinPath(baseDir, 'debug-bundle.js');
      fm.writeString(debugPath, allJs);
      console.log(`📝 Debug saved: debug-bundle.js`);
      
    } catch (e) {
      console.error('❌ Error:', e);
    }
  }
  
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>KavNav Modular</title>
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
      <div class="nearby-header">תחנות קרובות</div>
      <div id="nearbyStopsList" class="nearby-list">
        <div style="padding:20px; text-align:center; color:#888;">טוען...</div>
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
    console.log("🌐 HTML loaded");
  </script>
  ${isScriptable && allJs ? `<script>${allJs}</script>` : ''}
  <script>
    console.log("🎬 All scripts loaded");
    console.log("📋 window.initStaticData exists?", typeof window.initStaticData);
    console.log("📋 window.updateRealtimeData exists?", typeof window.updateRealtimeData);
    console.log("📋 window.initNearbyStops exists?", typeof window.initNearbyStops);
    console.log("📋 window.setUserLocation exists?", typeof window.setUserLocation);
  </script>
</body>
</html>`;
};