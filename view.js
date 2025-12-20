// view.js
// בונה HTML משולב

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
  <title>מפת קווים ותחנות</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

  <!-- Icons -->
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
  <!-- Mode Switcher -->
  <div id="mode-switcher">
    <button class="mode-btn active" data-mode="both" title="תצוגה משולבת">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M3,3H11V11H3V3M13,3H21V11H13V3M3,13H11V21H3V13M13,13H21V21H13V13Z"/>
      </svg>
    </button>
    <button class="mode-btn" data-mode="map" title="מפה בלבד">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M15,19L9,16.89V5L15,7.11M20.5,3C20.44,3 20.39,3 20.34,3L15,5.1L9,3L3.36,4.9C3.15,4.97 3,5.15 3,5.38V20.5A0.5,0.5 0 0,0 3.5,21C3.55,21 3.61,21 3.66,20.97L9,18.9L15,21L20.64,19.1C20.85,19.03 21,18.85 21,18.62V3.5A0.5,0.5 0 0,0 20.5,3Z"/>
      </svg>
    </button>
    <button class="mode-btn" data-mode="stations" title="תחנות בלבד">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M12,2A7,7 0 0,1 19,9C19,14.25 12,22 12,22C12,22 5,14.25 5,9A7,7 0 0,1 12,2M12,4A5,5 0 0,0 7,9C7,10 7,12 12,18.71C17,12 17,10 17,9A5,5 0 0,0 12,4M12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5Z"/>
      </svg>
    </button>
  </div>

  <!-- Container -->
  <div id="unified-container" class="mode-both">
    
    <!-- Map Section -->
    <div id="map-section">
      <div id="map">
        <button id="locateMeBtn" title="המיקום שלי">📍</button>
      </div>

      <div id="bottomSheet">
        <div id="dragHandleArea"><div class="handle-bar"></div></div>
        <div id="routesContainer"></div>
        <div class="footer-note-global">המיקום מוערך ע"י המערכת (ETA) • מבוסס KavNav</div>
      </div>
    </div>

    <!-- Stations Section -->
    <div id="stations-section">
      <!-- Search -->
      <div id="search-overlay"></div>
      <div id="search-container">
        <input type="text" id="search-input" placeholder="חיפוש תחנה..." />
        <div id="search-results"></div>
      </div>

      <header>
        <button id="refresh-btn">
          <svg viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </button>
        <div id="scroll-area"></div>
      </header>

      <div id="content"></div>
    </div>

  </div>

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