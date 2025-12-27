// view.js
// בונה HTML עם bundle מלא - גרסת Mapbox עם הודעות שגיאה

module.exports.getHtml = function() {
  const isScriptable = typeof FileManager !== 'undefined';
  
  let allCss = '';
  let allJs = '';
  
  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const baseDir = fm.documentsDirectory();
      
      console.log("🔧 Building modular bundle with Mapbox 3D...");
      
      // CSS
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
          console.log("✅ Loaded CSS:", f);
        } else {
          console.warn("⚠️ Missing CSS:", f);
        }
      });
      
      // JS - בסדר הנכון!
      const jsFiles = [
        'modules/ui/utils.js',          // 1. פונקציות עזר (getVariedColor)
        'modules/map/busModelLayer.js', // ✅ 3D GLB layer (must be BEFORE mapManager/busMarkers)
        'modules/map/mapManager.js',    // 2. מנהל מפה
        'modules/map/userLocation.js',  // 3. מיקום משתמש
        'modules/map/busMarkers.js',    // 4. רכבים (GLB)
        'modules/routes/bottomSheet.js',// 5. bottom sheet
        'modules/routes/routeCard.js',  // 6. כרטיסי קו
        'modules/stops/nearbyPanel.js', // 7. פאנל תחנות
        'modules/ui/modeToggle.js',     // 8. החלפת מצבים
        'web/app.js'                    // 9. אפליקציה ראשית
      ];
      
      jsFiles.forEach(f => {
        const p = fm.joinPath(baseDir, f);
        if (fm.fileExists(p)) {
          let code = fm.readString(p);
          
          // Remove module.exports and require statements for browser
          code = code.replace(/module\.exports\s*=\s*/g, '');
          code = code.replace(/require\([^)]+\)/g, 'null');
          code = code.replace(/export\s+/g, '');
          code = code.replace(/import\s+.*?;?\n/g, '');
          
          allJs += '\n// ===== ' + f + ' =====\n' + code + '\n';
          console.log("✅ Loaded JS:", f);
        } else {
          console.warn("⚠️ Missing JS:", f);
        }
      });
      
      console.log("✅ Bundle complete");
    } catch (e) {
      console.error("❌ Bundle error:", e);
    }
  }

  return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>KavNav Mapbox 3D</title>
  
  <!-- Mapbox GL JS -->
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"></script>
  
  <!-- Three.js + GLTFLoader (for GLB buses) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
  
  <style>
    ${allCss}
    
    /* Error overlay */
    #errorOverlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 20px;
      font-family: monospace;
      font-size: 14px;
      overflow: auto;
      z-index: 9999;
      display: none;
    }
    
    #errorOverlay h2 {
      color: #ff6b6b;
      margin-top: 0;
    }
    
    #errorOverlay pre {
      white-space: pre-wrap;
      word-break: break-word;
    }
    
    #closeError {
      position: fixed;
      top: 10px;
      right: 10px;
      background: #ff6b6b;
      border: none;
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      cursor: pointer;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="container">
      <!-- Top bar -->
      <div class="top-bar">
        <div class="mode-toggle-container" id="modeToggleContainer">
          <!-- Mode toggle will be inserted here -->
        </div>
      </div>
      
      <!-- Main content -->
      <div class="main-content">
        <!-- Map panel -->
        <div class="pane pane-map" id="mapPane">
          <div class="pane-header">
            <span>🗺️ מפה</span>
          </div>
          <div class="pane-content pane-map-content">
            <div id="map" class="map-container"></div>
            <button id="locateMeBtn" title="מיקום שלי">📍</button>
            <button id="toggle3DBtn" title="החלף 3D">🏢</button>
          </div>
        </div>
        
        <!-- Routes panel -->
        <div class="pane pane-routes" id="routesPane">
          <div class="pane-header">
            <span>🚌 קווים</span>
          </div>
          <div class="pane-content">
            <div id="routeCards" class="route-cards"></div>
          </div>
        </div>
        
        <!-- Stops panel -->
        <div class="pane pane-stops" id="stopsPane">
          <div class="pane-header">
            <span>🚏 תחנות</span>
          </div>
          <div class="pane-content">
            <div id="nearbyPanel" class="nearby-panel"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Bottom sheet -->
  <div id="bottomSheet" class="bottom-sheet">
    <div class="bottom-sheet-handle"></div>
    <div id="bottomSheetContent" class="bottom-sheet-content"></div>
  </div>
  
  <!-- Error overlay -->
  <div id="errorOverlay">
    <button id="closeError">✕ סגור</button>
    <h2>❌ שגיאה</h2>
    <pre id="errorContent"></pre>
  </div>
  
  <script>
    // Global config
    window.IS_SCRIPTABLE = ${isScriptable};
    window.MAPBOX_TOKEN = "pk.eyJ1IjoiZGF2aWRwb3ZhcnNreSIsImEiOiJjbXhpMHVwZGUwMGMzMndvOW8xYWxkZ3hxIn0.m6tzqC4Nt51iIwSpNCeUQg";
    
    // Error handling
    function showError(err, context = '') {
      console.error("❌ Error:", err);
      
      const overlay = document.getElementById('errorOverlay');
      const content = document.getElementById('errorContent');
      
      let errorText = '';
      if (context) errorText += `Context: ${context}\n\n`;
      errorText += `Error: ${err.message || err}\n\n`;
      if (err.stack) errorText += `Stack:\n${err.stack}`;
      
      content.textContent = errorText;
      overlay.style.display = 'block';
    }
    
    window.onerror = function(msg, url, line, col, error) {
      showError(error || msg, `${url}:${line}:${col}`);
      return true;
    };
    
    window.addEventListener('unhandledrejection', function(event) {
      showError(event.reason, 'Unhandled Promise Rejection');
    });
    
    document.getElementById('closeError').onclick = function() {
      document.getElementById('errorOverlay').style.display = 'none';
    };
    
    // Load bundled code
    try {
      (function() {
        ${allJs}
      })();
      
      console.log("✅ All modules loaded");
      
      // Initialize app when DOM ready
      if (typeof initApp === 'function') {
        document.addEventListener('DOMContentLoaded', initApp);
      } else {
        throw new Error("initApp function not found!");
      }
      
    } catch (e) {
      showError(e, 'Bundle execution');
    }
  </script>
</body>
</html>
`;
};