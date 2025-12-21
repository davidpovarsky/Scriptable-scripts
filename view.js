// view.js
// בונה HTML שטוען את הקבצים המקומיים או מ-GitHub

module.exports.getHtml = function() {
  const isScriptable = typeof FileManager !== 'undefined';

  let cssContent = '';
  let jsContent = '';

  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const webDir = fm.joinPath(fm.documentsDirectory(), "web");

      const cssPath = fm.joinPath(webDir, "style.css");
      const jsPath  = fm.joinPath(webDir, "app.js");

      if (fm.fileExists(cssPath)) cssContent = fm.readString(cssPath);
      if (fm.fileExists(jsPath)) jsContent = fm.readString(jsPath);
    } catch (e) {
      console.error("Failed reading local web files:", e);
    }
  }

  const cssTag = (isScriptable && cssContent)
    ? `<style>${cssContent}</style>`
    : `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/davidpovarsky/Scriptable-scripts@main/web/style.css">`;

  const jsTag = (isScriptable && jsContent)
    ? `<script>${jsContent}</script>`
    : `<script src="https://cdn.jsdelivr.net/gh/davidpovarsky/Scriptable-scripts@main/web/app.js"></script>`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>מסלולי קווים</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0&icon_names=directions_bus,swap_horiz,close,refresh" />

  <!-- Leaflet -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

  ${cssTag}
</head>
<body class="mode-map" data-mode="map">
  <div id="appLayout">

    <div id="mainArea">
      <div id="map">
        <button id="locateMeBtn" title="המיקום שלי">📍</button>

        <!-- מצב תצוגה (בועה) -->
        <button id="modeToggle" class="bubble-btn" title="מצב תצוגה">
          <span class="material-symbols-outlined">swap_horiz</span>
          <span class="bubble-label">מפה</span>
        </button>
      </div>

      <div id="bottomSheet">
        <div id="dragHandleArea"><div class="handle-bar"></div></div>
        <div id="routesContainer"></div>
        <div class="footer-note-global">המיקום מוערך ע\"י המערכת (ETA) • מבוסס KavNav</div>
      </div>
    </div>

    <aside id="stopsPanel" aria-label="תחנות קרובות">
      <div class="sp-header">
        <div class="sp-title">
          <div class="sp-title-main">תחנות קרובות</div>
          <div class="sp-title-sub">זמן אמת + מתוכנן</div>
        </div>
        <button class="sp-icon-btn" id="spRefreshBtn" title="רענון תחנות">
          <span class="material-symbols-outlined">refresh</span>
        </button>
        <button class="sp-icon-btn sp-close" id="spCloseBtn" title="סגור">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="sp-stops-strip" id="spStopsStrip"></div>

      <div class="sp-content">
        <div class="sp-loader" id="spLoader">
          <div class="sp-spinner"></div>
          <div id="spMsg">טוען תחנות קרובות…</div>
        </div>

        <div class="sp-stop-view" id="spStopView" style="display:none">
          <h2 class="sp-stop-title" id="spStopTitle">תחנה</h2>
          <div id="spCards"></div>
          <div class="sp-empty" id="spEmpty" style="display:none">אין נסיעות קרובות</div>
        </div>
      </div>
    </aside>
  </div>

  <script>
    window.APP_ENVIRONMENT = 'scriptable';
  </script>

  ${jsTag}
</body>
</html>`;
};