// view.js
// בונה HTML עם bundle מלא - גרסת DEBUG עם לוגים

module.exports.getHtml = function() {
  const isScriptable = typeof FileManager !== 'undefined';
  
  let allCss = '';
  let allJs = '';
  
  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const baseDir = fm.documentsDirectory();
      
      console.log("🔧 Building modular bundle with 3D support...");
      
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
      allJs += '  console.log("🔧 KavNav 3D Bundle Loading...");\n\n';
      
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

console.log("✅ KavNav 3D Bundle Complete");
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
  <title>KavNav 3D - DEBUG</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  
  <!-- Google Fonts & Icons -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0" />
  
  <!-- MapLibre GL JS (3D Maps!) -->
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js" onerror="console.error('MapLibre failed to load')"></script>
  
  <!-- Leaflet (2D Fallback) -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  
  <style>
    /* Debug Console */
    #debugConsole {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 150px;
      background: rgba(0,0,0,0.9);
      color: #0f0;
      font-family: monospace;
      font-size: 11px;
      overflow-y: auto;
      z-index: 10000;
      padding: 10px;
      display: none;
      direction: ltr;
      text-align: left;
    }
    #debugToggle {
      position: fixed;
      bottom: 160px;
      left: 10px;
      background: #000;
      color: #0f0;
      border: 2px solid #0f0;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: monospace;
      cursor: pointer;
      z-index: 10001;
    }
    .log-error { color: #f00; }
    .log-warn { color: #ff0; }
    .log-info { color: #0ff; }
    .log-success { color: #0f0; }
  </style>
  
  ${isScriptable && allCss ? `<style>${allCss}</style>` : ''}
</head>
<body class="mode-map-only">
  <!-- Debug Console -->
  <button id="debugToggle" onclick="toggleDebug()">🐛 Console</button>
  <div id="debugConsole"></div>

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
        <div class="footer-note-global">ETA • KavNav 3D</div>
      </div>
    </div>
  </div>

  <script>
    // ===== Debug Console =====
    const debugConsole = document.getElementById('debugConsole');
    let debugVisible = false;
    
    function toggleDebug() {
      debugVisible = !debugVisible;
      debugConsole.style.display = debugVisible ? 'block' : 'none';
    }
    
    function addLog(message, type = 'info') {
      const time = new Date().toLocaleTimeString();
      const div = document.createElement('div');
      div.className = 'log-' + type;
      div.textContent = time + ' | ' + message;
      debugConsole.appendChild(div);
      debugConsole.scrollTop = debugConsole.scrollHeight;
    }
    
    // Override console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = function(...args) {
      originalLog.apply(console, args);
      addLog(args.join(' '), 'info');
    };
    
    console.error = function(...args) {
      originalError.apply(console, args);
      addLog('ERROR: ' + args.join(' '), 'error');
    };
    
    console.warn = function(...args) {
      originalWarn.apply(console, args);
      addLog('WARN: ' + args.join(' '), 'warn');
    };
    
    // Catch all errors
    window.addEventListener('error', (e) => {
      addLog('UNCAUGHT ERROR: ' + e.message + ' at ' + e.filename + ':' + e.lineno, 'error');
    });
    
    window.addEventListener('unhandledrejection', (e) => {
      addLog('PROMISE REJECTION: ' + e.reason, 'error');
    });
    
    // Check MapLibre availability
    addLog('Starting KavNav 3D...', 'info');
    addLog('MapLibre available: ' + (typeof maplibregl !== 'undefined'), 'info');
    
    window.APP_ENVIRONMENT = 'scriptable';
    console.log('🌍 Environment: Scriptable (3D Mode)');
  </script>
  ${isScriptable && allJs ? `<script>${allJs}</script>` : ''}
  
  <script>
    // Show debug console after 2 seconds
    setTimeout(() => {
      toggleDebug();
    }, 2000);
  </script>
</body>
</html>`;
};