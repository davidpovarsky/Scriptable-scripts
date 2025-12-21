// view.js
// בונה HTML עבור KavNav (מפות/מסלולים/תחנות) + DEBUG
// תומך בשני מצבים:
// 1) Fallback: web/style.css + web/app.js
// 2) Modular bundle: styles/* + modules/* + web/app.js (כמו ששלחת)

module.exports.getHtml = function () {
  const isScriptable = typeof FileManager !== "undefined";

  let inlineCss = "";
  let inlineJs = "";

  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const baseDir = fm.documentsDirectory();

      const log = (...args) => console.log("🧩 view.js:", ...args);
      const warn = (...args) => console.warn("🧩 view.js:", ...args);
      const err = (...args) => console.error("🧩 view.js:", ...args);

      log("Starting HTML build…");
      log("baseDir =", baseDir);

      // ---------- Detect modular files ----------
      const modularCssFiles = [
        "styles/base.css",
        "styles/map.css",
        "styles/stops.css",
        "styles/routes.css",
      ];

      const modularJsFiles = [
        "modules/ui/utils.js",           // 1. helpers
        "modules/map/mapManager.js",     // 2. MapManager
        "modules/map/busMarkers.js",     // 3. BusMarkers
        "modules/map/userLocation.js",   // 4. UserLocationManager
        "modules/stops/nearbyPanel.js",  // 5. NearbyPanel
        "modules/routes/bottomSheet.js", // 6. BottomSheet
        "modules/routes/routeCard.js",   // 7. RouteCard
        "modules/ui/modeToggle.js",      // 8. ModeToggle
        "web/app.js",                    // 9. init/window functions
      ];

      const existsAll = (files) =>
        files.every((f) => fm.fileExists(fm.joinPath(baseDir, f)));

      const hasModular = existsAll(modularJsFiles) || existsAll(modularCssFiles);

      // ---------- Fallback paths ----------
      const webDir = fm.joinPath(baseDir, "web");
      const fallbackCssPath = fm.joinPath(webDir, "style.css");
      const fallbackJsPath = fm.joinPath(webDir, "app.js");

      const hasFallback = fm.fileExists(fallbackCssPath) || fm.fileExists(fallbackJsPath);

      log("hasModular =", hasModular, "| hasFallback =", hasFallback);

      // ---------- Build CSS ----------
      if (hasModular) {
        log("Building CSS from modular styles/* …");

        let css = "";
        for (const f of modularCssFiles) {
          const p = fm.joinPath(baseDir, f);
          if (fm.fileExists(p)) {
            const s = fm.readString(p);
            css += `\n/* ===== ${f} ===== */\n` + s + "\n";
            log("✅ CSS added:", f, `(${s.length} chars)`);
          } else {
            warn("❌ Missing CSS:", f);
          }
        }

        inlineCss = css.trim();
      } else {
        // fallback
        if (fm.fileExists(fallbackCssPath)) {
          const s = fm.readString(fallbackCssPath);
          inlineCss = s;
          log("✅ Fallback CSS loaded: web/style.css", `(${s.length} chars)`);
        } else {
          warn("No CSS found (neither modular nor fallback).");
        }
      }

      // ---------- Build JS ----------
      if (hasModular) {
        log("Building JS bundle from modular modules/* …");

        let bundle = `
console.log("🔧 Loading KavNav bundle…");
(function(){
  "use strict";

  const __KAVNAV_DEBUG__ = true;
  const __log = (...a) => console.log("🧩 bundle:", ...a);
  const __warn = (...a) => console.warn("🧩 bundle:", ...a);
  const __err = (...a) => console.error("🧩 bundle:", ...a);

  __log("Bundle start");
`;

        const stripImportsExports = (code) => {
          // NOTE: זה נועד ל"להדביק" מודולים לקובץ אחד.
          // אם יש אצלך דפוסים אחרים של import/export, אפשר להרחיב כאן.
          return code
            .replace(/export\s+class\s+/g, "class ")
            .replace(/export\s+function\s+/g, "function ")
            .replace(/export\s+const\s+/g, "const ")
            .replace(/export\s+\{[^}]+\}\s*;?\s*/g, "")
            .replace(/export\s+default\s+/g, "")
            // import {...} from '...';
            .replace(/import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"]\s*;?\s*/g, "")
            // import X from '...';
            .replace(/import\s+[^\n;]+from\s+['"][^'"]+['"]\s*;?\s*/g, "")
            // import '...';
            .replace(/import\s+['"][^'"]+['"]\s*;?\s*/g, "");
        };

        modularJsFiles.forEach((file, idx) => {
          const p = fm.joinPath(baseDir, file);
          if (!fm.fileExists(p)) {
            err("❌ Missing JS file:", file);
            bundle += `\n__err("Missing file: ${file}");\n`;
            return;
          }

          let code = fm.readString(p);
          const originalLen = code.length;

          code = stripImportsExports(code);

          bundle += `\n// ===== ${idx + 1}. ${file} =====\n`;
          bundle += `__log("Loading: ${file}");\n`;
          bundle += code + "\n";

          log("✅ JS added:", file, `(original ${originalLen} chars, stripped ${code.length} chars)`);
        });

        bundle += `
  __log("Bundle loaded OK");
})();
`;

        inlineJs = bundle.trim();

        // שמירת debug copy שתוכל לפתוח ולבדוק מה בדיוק נבנה
        try {
          const debugPath = fm.joinPath(baseDir, "debug-bundle.js");
          fm.writeString(debugPath, inlineJs);
          log("📝 debug-bundle.js saved:", debugPath);
        } catch (e) {
          warn("Could not save debug-bundle.js:", e);
        }
      } else {
        // fallback JS
        if (fm.fileExists(fallbackJsPath)) {
          const s = fm.readString(fallbackJsPath);
          inlineJs = s;
          log("✅ Fallback JS loaded: web/app.js", `(${s.length} chars)`);
        } else {
          warn("No JS found (neither modular nor fallback).");
        }
      }

      log("Build complete. CSS chars:", inlineCss.length, "| JS chars:", inlineJs.length);
    } catch (e) {
      console.error("❌ view.js: Error building HTML:", e);
    }
  }

  // ---------- HTML ----------
  // חשוב: שומר על מבנה הדף (מפה + תחנות + bottom sheet) כפי שהיה אצלך.
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>KavNav</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,600,1,0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

  ${isScriptable && inlineCss ? `<style>\n${inlineCss}\n</style>` : ""}
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
        <div style="padding:20px; text-align:center; color:#888;">טוען...</div>
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

  <script>
    window.APP_ENVIRONMENT = 'scriptable';
    console.log("🌐 HTML loaded, APP_ENVIRONMENT =", window.APP_ENVIRONMENT);
  </script>

  ${isScriptable && inlineJs ? `<script>\n${inlineJs}\n</script>` : ""}

  <script>
    console.log("🎬 After bundle/fallback scripts.");
    const interesting = Object.keys(window).filter(k =>
      k.toLowerCase().includes('init') ||
      k.toLowerCase().includes('update') ||
      k.toLowerCase().includes('set') ||
      k.toLowerCase().includes('kavnav')
    );
    console.log("🔎 Interesting globals:", interesting);
  </script>
</body>
</html>`;
};
