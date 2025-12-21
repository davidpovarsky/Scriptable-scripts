// view.js
// בונה HTML עם תמיכה במודולים - גרסה מתוקנת!

module.exports.getHtml = function() {
  const isScriptable = typeof FileManager !== 'undefined';
  
  let allCss = '';
  let allJs = '';
  
  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const baseDir = fm.documentsDirectory();
      
      // ========================================
      // 1. טעינת CSS (פשוט - מחברים הכל)
      // ========================================
      const cssFiles = [
        'styles/base.css',
        'styles/map.css',
        'styles/stops.css',
        'styles/routes.css'
      ];
      
      cssFiles.forEach(file => {
        const path = fm.joinPath(baseDir, file);
        if (fm.fileExists(path)) {
          allCss += fm.readString(path) + '\n\n';
        }
      });
      
      // ========================================
      // 2. טעינת JS - סדר חשוב!
      // ========================================
      
      // המודולים בסדר הנכון (classes קודם)
      const moduleFiles = [
        'modules/map/mapManager.js',
        'modules/map/busMarkers.js',
        'modules/map/userLocation.js',
        'modules/stops/nearbyPanel.js',
        'modules/routes/bottomSheet.js',
        'modules/routes/routeCard.js',
        'modules/ui/modeToggle.js',
        'modules/ui/utils.js'
      ];
      
      // קריאת כל המודולים
      const modules = {};
      moduleFiles.forEach(file => {
        const path = fm.joinPath(baseDir, file);
        if (fm.fileExists(path)) {
          let content = fm.readString(path);
          
          // הסרת export statements
          content = content.replace(/export\s+class\s+/g, 'class ');
          content = content.replace(/export\s+function\s+/g, 'function ');
          content = content.replace(/export\s+const\s+/g, 'const ');
          content = content.replace(/export\s+\{[^}]+\}/g, '');
          content = content.replace(/export\s+default\s+/g, '');
          
          // הסרת import statements
          content = content.replace(/import\s+.*?from\s+['"].*?['"]\s*;?\s*/g, '');
          
          modules[file] = content;
        }
      });
      
      // בניית הקוד המאוחד
      allJs = `
// ========================================
// KavNav Modular Bundle
// Built dynamically by view.js
// ========================================

(function() {
  'use strict';
  
  // ========================================
  // Modules
  // ========================================
  
`;
      
      // הוספת כל המודולים
      moduleFiles.forEach(file => {
        if (modules[file]) {
          allJs += `  // ${file}\n`;
          allJs += modules[file] + '\n\n';
        }
      });
      
      // טעינת app.js (הלוגיקה הראשית)
      const appPath = fm.joinPath(baseDir, 'web/app.js');
      if (fm.fileExists(appPath)) {
        let appContent = fm.readString(appPath);
        
        // הסרת כל ה-imports
        appContent = appContent.replace(/import\s+\{[^}]+\}\s+from\s+['"].*?['"]\s*;?\s*/g, '');
        appContent = appContent.replace(/import\s+.*?from\s+['"].*?['"]\s*;?\s*/g, '');
        
        allJs += `  // ========================================\n`;
        allJs += `  // Main App\n`;
        allJs += `  // ========================================\n\n`;
        allJs += appContent;
      }
      
      allJs += `
  
  console.log("📱 KavNav Modular Bundle Loaded");
  
})();
`;
      
    } catch (e) {
      console.error('Error building modular bundle:', e);
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
        <div style="padding:20px; text-align:center; color:#888;">טוען תחנות...</div>
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
