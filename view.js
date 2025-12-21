// view.js
module.exports.getHtml = function() {
  const isScriptable = typeof FileManager !== 'undefined';
  
  let cssContent = '';
  let jsContent = '';
  
  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const webDir = fm.joinPath(fm.documentsDirectory(), "web");
      const cssPath = fm.joinPath(webDir, "style.css");
      const jsPath = fm.joinPath(webDir, "app.js");
      if (fm.fileExists(cssPath)) cssContent = fm.readString(cssPath);
      if (fm.fileExists(jsPath)) jsContent = fm.readString(jsPath);
    } catch (e) { console.error(e); }
  }
  
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>KavNav Dual</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

  ${isScriptable && cssContent ? `<style>${cssContent}</style>` : ''}
</head>
<body class="mode-map-only"> <div id="modeToggleContainer">
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
  ${isScriptable && jsContent ? `<script>${jsContent}</script>` : ''}
</body>
</html>`;
};
