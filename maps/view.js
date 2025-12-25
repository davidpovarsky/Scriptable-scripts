// view.js
// בונה HTML עם bundle מלא + תמיכה ב-deck.gl + שכבת שגיאות על המסך

module.exports.getHtml = function () {
  const isScriptable = typeof FileManager !== "undefined";

  let allCss = "";
  let allJs = "";

  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const baseDir = fm.documentsDirectory();

      console.log("🔧 Building modular bundle...");

      // CSS
      const cssFiles = [
        "styles/base.css",
        "styles/map.css",
        "styles/stops.css",
        "styles/routes.css",
      ];

      cssFiles.forEach((file) => {
        const p = fm.joinPath(baseDir, file);
        if (fm.fileExists(p)) {
          allCss += fm.readString(p) + "\n";
          console.log(`✅ CSS: ${file}`);
        } else {
          console.log(`⚠️ Missing CSS: ${file}`);
        }
      });

      // JS (חשוב: סדר טעינה)
      const jsFiles = [
        "modules/ui/utils.js",
        "modules/map/mapManager.js",
        "modules/map/deck3d.js",      // ✅ חדש: 3D buses (deck.gl)
        "modules/map/busMarkers.js",
        "modules/map/userLocation.js",
        "modules/stops/nearbyPanel.js",
        "modules/routes/bottomSheet.js",
        "modules/routes/routeCard.js",
        "modules/ui/modeToggle.js",
        "web/app.js",
      ];

      // עטיפה כדי לא לזהם scope
      allJs += `(function(){\n`;

      jsFiles.forEach((file) => {
        const p = fm.joinPath(baseDir, file);
        if (fm.fileExists(p)) {
          let code = fm.readString(p);

          allJs += `\n  // ===== ${file} =====\n`;
          allJs += code
            .split("\n")
            .map((line) => "  " + line)
            .join("\n");
          allJs += "\n";

          console.log(`✅ JS: ${file}`);
        } else {
          console.log(`⚠️ Missing JS: ${file}`);
        }
      });

      // סגירה
      allJs += `\n})();\n`;
      allJs += `console.log("✅ KavNav Bundle Complete");\n`;
    } catch (e) {
      console.log("❌ Error building bundle:", e);
    }
  }

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>KavNav</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

  <!-- Material Symbols -->
  <link rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0" />

  <!-- Leaflet (CDN יציב יותר מ-unpkg) -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>

  <!-- deck.gl (ל-3D buses) -->
  <script src="https://unpkg.com/deck.gl@^9.0.0/dist.min.js"></script>

  ${isScriptable && allCss ? `<style>${allCss}</style>` : ""}

  <style>
    /* שכבת שגיאות על המסך - כדי לראות למה המפה לא עולה */
    #fatalOverlay {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: 12px;
      max-height: 45vh;
      overflow: auto;
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(0,0,0,0.78);
      color: #fff;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 1.35;
      z-index: 999999;
      display: none;
      white-space: pre-wrap;
      direction: ltr;
      text-align: left;
    }
    #fatalOverlay b { color: #ffd479; }
  </style>
</head>

<body class="mode-map-only">
  <div id="fatalOverlay"></div>

  <script>
    (function(){
      const box = document.getElementById('fatalOverlay');
      function show(msg){
        box.style.display = 'block';
        box.textContent = msg;
      }
      window.addEventListener('error', (e) => {
        const m = "JS ERROR:\\n" +
          (e.message || '') + "\\n" +
          (e.filename ? (e.filename + ":" + e.lineno + ":" + e.colno) : '') +
          (e.error && e.error.stack ? ("\\n\\n" + e.error.stack) : '');
        show(m);
      });
      window.addEventListener('unhandledrejection', (e) => {
        const r = e.reason;
        const m = "UNHANDLED PROMISE:\\n" +
          (r && r.message ? r.message : String(r)) +
          (r && r.stack ? ("\\n\\n" + r.stack) : '');
        show(m);
      });
    })();
  </script>

  <div id="modeToggleContainer">
    <div class="mode-toggle">
      <input type="radio" name="viewMode" id="modeDual" value="dual">
      <label for="modeDual">תצוגה כפולה</label>

      <input type="radio" name="viewMode" id="modeStops" value="stops">
      <label for="modeStops">תחנות בלבד</label>

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
      <div id="map" style="width:100%; height:100%;"></div>

      <div id="bottomSheet">
        <div id="dragHandleArea"><div class="handle-bar"></div></div>
        <div id="routesContainer"></div>
        <div class="footer-note-global">ETA • KavNav</div>
      </div>
    </div>
  </div>

  <script>window.APP_ENVIRONMENT = 'scriptable';</script>
  ${isScriptable && allJs ? `<script>${allJs}</script>` : ""}

</body>
</html>`;
};