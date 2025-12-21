// view.js
// תיקון: אם DOMContentLoaded כבר קרה, הרץ מיד!

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
      
      // JS
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
      
      allJs = `console.log("🔧 Loading KavNav...");\n\n`;
      
      jsFiles.forEach((file, idx) => {
        const path = fm.joinPath(baseDir, file);
        if (fm.fileExists(path)) {
          let code = fm.readString(path);
          
          // ניקוי
          code = code
            .replace(/export\s+(class|function|const|let|var)\s+/g, '$1 ')
            .replace(/export\s+\{[^}]+\}/g, '')
            .replace(/export\s+default\s+/g, '')
            .replace(/import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"]\s*;?\s*/g, '')
            .replace(/import\s+[^\n]+\n/g, '');
          
          // תיקון DOMContentLoaded - אם כבר נטען, הרץ מיד
          if (file === 'web/app.js') {
            code = code.replace(
              /document\.addEventListener\('DOMContentLoaded',\s*async\s+function\(\)\s*\{/,
              `(function() {
  const initApp = async function() {`
            );
            
            // סגירת הפונקציה והרצה
            code = code.replace(
              /\}\);[\s\n]*$/,
              `  };
  
  // הרץ מיד אם DOM כבר טעון, אחרת חכה
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    console.log("📋 DOM already loaded, running immediately");
    initApp();
  }
})();`
            );
          }
          
          allJs += `// ===== ${file} =====\n${code}\n\n`;
          console.log(`✅ JS: ${file}`);
        }
      });
      
      allJs += `console.log("✅ Bundle loaded");\n`;
      
      // Debug
      const debugPath = fm.joinPath(baseDir, 'debug-bundle.js');
      fm.writeString(debugPath, allJs);
      console.log(`📝 Debug: debug-bundle.js`);
      
    } catch (e) {
      console.error('❌ Error:', e);
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

  <script>window.APP_ENVIRONMENT = 'scriptable';</script>
  ${isScriptable && allJs ? `<script>${allJs}</script>` : ''}
  <script>
    console.log("🎬 Scripts loaded");
    console.log("window.initStaticData?", typeof window.initStaticData);
    console.log("window.updateRealtimeData?", typeof window.updateRealtimeData);
    console.log("window.initNearbyStops?", typeof window.initNearbyStops);
    console.log("window.setUserLocation?", typeof window.setUserLocation);
  </script>
</body>
</html>`;
};