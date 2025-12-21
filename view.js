// view.js
// בונה HTML שטוען את הקבצים המקומיים או מ-GitHub

module.exports.getHtml = function() {
  // בודק אם אנחנו ב-Scriptable
  const isScriptable = typeof FileManager !== 'undefined';

  let cssContent = '';
  let jsContent = '';

  if (isScriptable) {
    // טוען את הקבצים המקומיים (מנסה גם local וגם iCloud, וגם root וגם web/)
    try {
      const fmLocal = FileManager.local();
      const fmCloud = FileManager.iCloud();

      function tryRead(fm, relPath) {
        try {
          const p = fm.joinPath(fm.documentsDirectory(), relPath);
          try { fm.downloadFileFromiCloud && fm.downloadFileFromiCloud(p); } catch (e) {}
          if (fm.fileExists(p)) return fm.readString(p);
        } catch (e) {}
        return "";
      }

      // קודם ננסה את הנתיב החדש: web/...
      cssContent =
        tryRead(fmLocal, "web/style.css") ||
        tryRead(fmLocal, "style.css") ||
        tryRead(fmCloud, "web/style.css") ||
        tryRead(fmCloud, "style.css") ||
        "";

      jsContent =
        tryRead(fmLocal, "web/app.js") ||
        tryRead(fmLocal, "app.js") ||
        tryRead(fmCloud, "web/app.js") ||
        tryRead(fmCloud, "app.js") ||
        "";
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

  <!-- Leaflet (יותר יציב מ-unpkg בהרבה רשתות) -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>

  ${isScriptable && cssContent
    ? `<style>${cssContent}</style>`
    : '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/davidpovarsky/Scriptable-scripts@main/web/style.css">'
  }
</head>
<body>
  <div id="map">
    <button id="locateMeBtn" title="המיקום שלי">📍</button>
  </div>

  <div id="bottomSheet">
    <div id="sheetHeader">
      <div class="handle"></div>
      <div id="routeTitle">טוען...</div>
    </div>

    <div id="routeList"></div>
  </div>

  <!-- הגדרת מצב ריצה -->
  <script>
    window.APP_ENVIRONMENT = 'scriptable';
  </script>

  ${isScriptable && jsContent
    ? `<script>${jsContent}</script>`
    : '<script src="https://cdn.jsdelivr.net/gh/davidpovarsky/Scriptable-scripts@main/web/app.js"></script>'
  }
</body>
</html>`;
};