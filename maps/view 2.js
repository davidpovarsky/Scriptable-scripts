// view.js
// בונה HTML עם bundle מלא - גרסת Mapbox עם תמיכה ב-Three.js + GLB

module.exports.getHtml = function() {
  const isScriptable = typeof FileManager !== 'undefined';
  
  let allCss = '';
  let allJs = '';
  
  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const baseDir = fm.documentsDirectory();
      
      console.log("🔧 Building modular bundle with Mapbox 3D + Three.js...");
      
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
      allJs += '  console.log("🔧 KavNav Mapbox + Three.js Bundle Loading...");\n\n';
      
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

console.log("✅ KavNav Mapbox + Three.js Bundle Complete");
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
  <title>KavNav 3D Pro</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  
  <!-- Google Fonts & Icons -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0" />
  
  <!-- Mapbox GL JS -->
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"></script>
  
  <!-- Three.js + GLTFLoader for 3D Models -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
  
  <style>
    /* Error Message Overlay */
    #errorOverlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.95);
      color: white;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      padding: 20px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #errorOverlay.show {
      display: flex;
    }
    .error-content {
      max-width: 500px;
      background: #1a1a1a;
      padding: 30px;
      border-radius: 12px;
      border: 2px solid #ff4444;
    }
    .error-icon {
      font-size: 60px;
      margin-bottom: 20px;
    }
    .error-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #ff4444;
    }
    .error-message {
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 20px;
      color: #ccc;
    }
    .error-steps {
      text-align: right;
      direction: rtl;
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .error-steps ol {
      margin: 0;
      padding-right: 20px;
    }
    .error-steps li {
      margin: 10px 0;
      color: #fff;
    }
    .error-code {
      background: #000;
      padding: 10px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      margin: 10px 0;
      color: #0f0;
      text-align: left;
      direction: ltr;
      overflow-x: auto;
    }
    .error-link {
      color: #4af;
      text-decoration: none;
      font-weight: bold;
    }
  </style>
  
  ${isScriptable && allCss ? `<style>${allCss}</style>` : ''}
</head>
<body class="mode-map-only">
  <!-- Error Overlay -->
  <div id="errorOverlay">
    <div class="error-content">
      <div class="error-icon">🔒</div>
      <div class="error-title">דרוש Mapbox API Key</div>
      <div class="error-message">
        לא הוגדר Mapbox Access Token.<br>
        המפה לא יכולה להיטען ללא מפתח API.
      </div>
      <div class="error-steps">
        <strong>איך לתקן? (5 דקות):</strong>
        <ol>
          <li>
            הירשם ל-Mapbox:<br>
            <a href="https://account.mapbox.com/auth/signup/" class="error-link" target="_blank">
              account.mapbox.com/auth/signup
            </a>
          </li>
          <li>
            צור Access Token (לחץ "Create a token")
          </li>
          <li>
            העתק את ה-Token (מתחיל ב-<code>pk.eyJ...</code>)
          </li>
          <li>
            פתח את <code>view.js</code> ומצא:
            <div class="error-code">window.MAPBOX_TOKEN = 'YOUR_...';</div>
          </li>
          <li>
            החלף ב-Token שלך והעלה לגיטהאב
          </li>
        </ol>
      </div>
      <div style="margin-top: 20px; font-size: 14px; color: #888;">
        💡 50,000 קריאות בחינם בחודש!
      </div>
    </div>
  </div>

  <!-- Model Loading Indicator -->
  <div id="modelLoadingIndicator" class="model-loading-indicator hidden">
    <div class="loading-spinner"></div>
    <span>טוען מודל תלת-מימדי...</span>
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
        <button id="toggle3DBtn" title="מעבר בין 2D ל-3D" class="active">🗺️</button>
        <button id="toggleFlipBtn" title="הפוך כיוון אוטובוסים">🔄</button>
      </div>
      <div id="bottomSheet">
        <div id="dragHandleArea"><div class="handle-bar"></div></div>
        <div id="routesContainer"></div>
        <div class="footer-note-global">ETA • KavNav 3D Pro</div>
      </div>
    </div>
  </div>

  <script>
    // ===== MAPBOX ACCESS TOKEN =====
    // 🔑 שים כאן את ה-API key שלך מ-Mapbox!
    // הירשם ב: https://account.mapbox.com/auth/signup/
    
    window.MAPBOX_TOKEN = 'pk.eyJ1IjoiZGF2aWRwb3YiLCJhIjoiY21qbGNvMG1jMDkyZzNpcXJ6bzNwcnNtZiJ9.a2f__tImpmGUDc9ERCMXpg';
    
    // ===== Check Token =====
    window.APP_ENVIRONMENT = 'scriptable';
    console.log('🌐 Environment: Scriptable');
    
    if (!window.MAPBOX_TOKEN || window.MAPBOX_TOKEN === 'YOUR_MAPBOX_ACCESS_TOKEN_HERE') {
      console.error('❌ No Mapbox token!');
      
      // Show error overlay after 2 seconds if map doesn't load
      setTimeout(() => {
        const errorOverlay = document.getElementById('errorOverlay');
        if (errorOverlay) {
          errorOverlay.classList.add('show');
        }
      }, 2000);
    } else {
      console.log('✅ Mapbox token configured');
    }
    
    // ===== Wait for Three.js to load =====
    function waitForThreeJS(callback) {
      if (typeof THREE !== 'undefined' && THREE.GLTFLoader) {
        console.log('✅ Three.js loaded:', THREE.REVISION);
        console.log('✅ GLTFLoader available');
        callback();
      } else {
        console.log('⏳ Waiting for Three.js...');
        setTimeout(() => waitForThreeJS(callback), 100);
      }
    }
  </script>
  ${isScriptable && allJs ? `<script>
    // Wait for Three.js before running the bundle
    waitForThreeJS(function() {
      console.log('🎬 Starting bundle after Three.js loaded...');
      ${allJs}
    });
  </script>` : ''}
</body>
</html>`;
};