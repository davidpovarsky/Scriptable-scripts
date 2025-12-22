// view.js
// בונה HTML שטוען את הקבצים המקומיים או מ-GitHub

module.exports.getHtml = function() {
  // בודק אם אנחנו ב-Scriptable
  const isScriptable = typeof FileManager !== 'undefined';
  
  let cssContent = '';
  let jsContent = '';
  
  if (isScriptable) {
    // טוען את הקבצים המקומיים
    try {
      const fm = FileManager.local();
      const webDir = fm.joinPath(fm.documentsDirectory(), "web");
      
      const cssPath = fm.joinPath(webDir, "style.css");
      const jsPath = fm.joinPath(webDir, "app.js");
      
      if (fm.fileExists(cssPath)) {
        cssContent = fm.readString(cssPath);
      }
      if (fm.fileExists(jsPath)) {
        jsContent = fm.readString(jsPath);
      }
    } catch (e) {
      console.error("Error loading web files:", e);
    }
  }
  
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>מסלולי קווים</title>
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
</head>
<body>
  <div id="map">
    <button id="locateMeBtn" title="המיקום שלי">📍</button>
  </div>

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
</body>
</html>`;
};
