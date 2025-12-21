// view.js
// בונה HTML שטוען את הקבצים המקומיים או מ-GitHub

module.exports.getHtml = function() {
  // בודק אם אנחנו ב-Scriptable
  const isScriptable = typeof FileManager !== 'undefined';
  
  let cssContent = '';
  let jsContent = '';
  let kavnavCssContent = '';
  let kavnavJsContent = '';
  let integrationJsContent = '';
  
  if (isScriptable) {
    // טוען את הקבצים המקומיים
    try {
      const fm = FileManager.local();
      const webDir = fm.joinPath(fm.documentsDirectory(), "web");
      
      const cssPath = fm.joinPath(webDir, "style.css");
      const jsPath = fm.joinPath(webDir, "app.js");
      const kavnavCssPath = fm.joinPath(webDir, "style_stations.css");
      const kavnavJsPath = fm.joinPath(webDir, "app_stations.js");
      const integrationJsPath = fm.joinPath(webDir, "integration.js");
      
      if (fm.fileExists(cssPath)) {
        cssContent = fm.readString(cssPath);
      }
      if (fm.fileExists(jsPath)) {
        jsContent = fm.readString(jsPath);
      }
      if (fm.fileExists(kavnavCssPath)) {
        kavnavCssContent = fm.readString(kavnavCssPath);
      }
      if (fm.fileExists(kavnavJsPath)) {
        kavnavJsContent = fm.readString(kavnavJsPath);
      }
      if (fm.fileExists(integrationJsPath)) {
        integrationJsContent = fm.readString(integrationJsPath);
      }
    } catch (e) {
      console.error("Error loading web files:", e);
    }
  }
  
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>מסלולי קווים + תחנות קרובות</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

  <!-- Icons font -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0&icon_names=directions_bus" />

  <!-- Leaflet -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

  ${isScriptable && cssContent ? 
    `<style>${cssContent}</style>` : 
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/davidpovarsky/Scriptable-scripts@main/web/style.css">'
  }
  
  ${isScriptable && kavnavCssContent ? 
    `<style>${kavnavCssContent}</style>` : 
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/davidpovarsky/Scriptable-scripts@main/web/style_stations.css">'
  }
</head>
<body>
  <!-- כפתור Toggle לפאנל הצדדי -->
  <button id="toggleSidePanel" class="toggle-btn" title="הצג/הסתר תחנות קרובות">
    <span class="material-symbols-outlined">view_sidebar</span>
  </button>

  <!-- פאנל צדדי לתחנות קרובות -->
  <div id="sidePanel" class="side-panel">
    <div id="sidePanelContent">
      <div id="loader-msg-stations">
        <div class="spinner"></div>
        <div>טוען תחנות קרובות...</div>
      </div>
      <div class="stop-container-stations" style="display:none">
        <h2 id="stop-title-stations"></h2>
        <div id="cards-container-stations"></div>
        <div id="empty-msg-stations">אין נסיעות קרובות</div>
      </div>
    </div>
  </div>

  <!-- מפה ראשית -->
  <div id="map">
    <button id="locateMeBtn" title="המיקום שלי">📍</button>
  </div>

  <!-- Bottom Sheet למסלולים -->
  <div id="bottomSheet">
    <div id="dragHandleArea"><div class="handle-bar"></div></div>
    <div id="routesContainer"></div>
    <div class="footer-note-global">המיקום מוערך ע"י המערכת (ETA) • מבוסס KavNav</div>
  </div>

  <!-- הגדרת מצב ריצה -->
  <script>
    window.APP_ENVIRONMENT = 'scriptable';
  </script>

  ${isScriptable && jsContent ? 
    `<script>${jsContent}</script>` : 
    '<script src="https://cdn.jsdelivr.net/gh/davidpovarsky/Scriptable-scripts@main/web/app.js"></script>'
  }
  
  ${isScriptable && kavnavJsContent ? 
    `<script>${kavnavJsContent}</script>` : 
    '<script src="https://cdn.jsdelivr.net/gh/davidpovarsky/Scriptable-scripts@main/web/app_stations.js"></script>'
  }
  
  ${isScriptable && integrationJsContent ? 
    `<script>${integrationJsContent}</script>` : 
    '<script src="https://cdn.jsdelivr.net/gh/davidpovarsky/Scriptable-scripts@main/web/integration.js"></script>'
  }
</body>
</html>`;
};