// view.js
// בונה HTML עם bundle מלא - גרסת Three.js GLB Integration

module.exports.getHtml = function() {
  const isScriptable = typeof FileManager !== 'undefined';
  
  let allCss = '';
  let allJs = '';
  
  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const baseDir = fm.documentsDirectory();
      
      console.log("🔧 Building modular bundle with Three.js...");
      
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
      
      allJs = '(function() {\n';
      allJs += '  "use strict";\n\n';
      
      jsFiles.forEach((file) => {
        const path = fm.joinPath(baseDir, file);
        if (fm.fileExists(path)) {
          let code = fm.readString(path);
          // ניקוי imports/exports כדי שהכל ירוץ בקובץ אחד
          code = code
            .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, '')
            .replace(/^export\s+(class|function|const|let|var)\s+/gm, '$1 ')
            .replace(/^export\s+default\s+/gm, '')
            .replace(/^export\s+\{[^}]+\};?\s*$/gm, '')
            .replace(/\n{3,}/g, '\n\n');
          
          allJs += `  // ===== ${file} =====\n`;
          allJs += code + '\n\n';
        }
      });
      
      allJs += `
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async function() {
      await initApp();
    });
  } else {
    initApp().catch(e => console.error("Init error:", e));
  }
})();
`;
    } catch (e) {
      console.error('Bundle error:', e);
    }
  }
  
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>KavNav 3D GLB</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0" />
  
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"></script>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
  
  <style>
    /* Error Overlay Styles */
    #errorOverlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.95); color: white;
      display: none; align-items: center; justify-content: center; z-index: 99999;
      padding: 20px; text-align: center; font-family: sans-serif;
    }
    #errorOverlay.show { display: flex; }
    .error-content { max-width: 500px; background: #1a1a1a; padding: 30px; border-radius: 12px; border: 2px solid #ff4444; }
    .error-code { background: #000; padding: 10px; font-family: monospace; color: #0f0; direction: ltr; }
  </style>
  
  ${isScriptable && allCss ? `<style>${allCss}</style>` : ''}
</head>
<body class="mode-map-only">
  <div id="errorOverlay">
    <div class="error-content">
      <h2>חסר מפתח Mapbox</h2>
      <p>נא להגדיר את MAPBOX_TOKEN ב-view.js</p>
    </div>
  </div>

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
        <div class="footer-note-global">ETA • KavNav GLB</div>
      </div>
    </div>
  </div>

  <script>
    // 🔑 הגדרת TOKEN - וודא שזה הטוקן שלך!
    window.MAPBOX_TOKEN = 'pk.eyJ1IjoiZGF2aWRwb3YiLCJhIjoiY21qbGNvMG1jMDkyZzNpcXJ6bzNwcnNtZiJ9.a2f__tImpmGUDc9ERCMXpg';
    
    window.APP_ENVIRONMENT = 'scriptable';
    
    if (!window.MAPBOX_TOKEN || window.MAPBOX_TOKEN.includes('YOUR_')) {
      setTimeout(() => document.getElementById('errorOverlay').classList.add('show'), 2000);
    }
  </script>
  ${isScriptable && allJs ? `<script>${allJs}</script>` : ''}
</body>
</html>`;
};
