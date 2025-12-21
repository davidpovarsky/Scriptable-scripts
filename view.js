// view.js
// בונה HTML משולב: מפה (Project 1) + לוח תחנות (Project 2)

module.exports.getHtml = function() {
  const isScriptable = typeof FileManager !== 'undefined';
  
  // תוכן עבור המפה (פרויקט 1)
  let mapCss = '';
  let mapJs = '';
  
  // תוכן עבור התחנות (פרויקט 2)
  let stationsCss = '';
  let stationsJs = '';

  if (isScriptable) {
    try {
      const fm = FileManager.local();
      const webDir = fm.joinPath(fm.documentsDirectory(), "web");
      
      // טעינת קבצי המפה המקוריים
      const mapCssPath = fm.joinPath(webDir, "style.css");
      const mapJsPath = fm.joinPath(webDir, "app.js");
      if (fm.fileExists(mapCssPath)) mapCss = fm.readString(mapCssPath);
      if (fm.fileExists(mapJsPath)) mapJs = fm.readString(mapJsPath);

      // טעינת קבצי התחנות (שמרנו אותם בשמות חדשים כדי למנוע דריסה)
      const stCssPath = fm.joinPath(webDir, "style_stations.css");
      const stJsPath = fm.joinPath(webDir, "app_stations.js");
      
      if (fm.fileExists(stCssPath)) stationsCss = fm.readString(stCssPath);
      // אם לא קיים קובץ ייעודי, ננסה לטעון את style.css של פרויקט 2 אם המשתמש שמר אותו בשם אחר
      
      if (fm.fileExists(stJsPath)) stationsJs = fm.readString(stJsPath);

    } catch (e) {
      console.error("Error loading web files:", e);
    }
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

  <style>
    /* CSS של המפה (גלובלי ברובו) */
    ${mapCss}

    /* תיקונים למצב משולב */
    body { overflow: hidden; } /* מניעת גלילה כפולה */
    
    /* כפתור החלפת מצבים */
    #modeToggle {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 9999;
      background: #1f2937;
      color: white;
      border: 1px solid #374151;
      border-radius: 20px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-family: sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    
    /* פריסת מסך */
    #main-container {
      display: flex;
      width: 100vw;
      height: 100vh;
      position: relative;
    }

    /* אזור המפה */
    #map-wrapper {
      flex: 1;
      position: relative;
      transition: width 0.3s ease;
      height: 100%;
    }
    
    /* המפה עצמה */
    #map {
      width: 100%;
      height: 100%;
    }

    /* אזור התחנות (צד ימין/שמאל בהתאם ל-RTL) */
    #stations-panel {
      width: 0;
      background: #0b0f14;
      border-left: 1px solid #374151;
      transition: width 0.3s ease;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    /* מצב כפול פעיל */
    body.dual-mode #stations-panel {
      width: 400px; /* רוחב הפאנל */
      max-width: 90vw;
    }
    
    /* הסתרת ה-Bottom Sheet של המפה כשיש פאנל צדדי (אופציונלי - כרגע נשאיר) */
    /* body.dual-mode #bottomSheet { display: none; } */

    /* CSS ספציפי לתחנות (Project 2) בתוך הפאנל */
    #stations-panel-content {
      height: 100%;
      overflow-y: auto;
      position: relative;
    }

    /* הזרקת ה-CSS של פרויקט 2 */
    ${stationsCss}
    
    /* דריסות קטנות ל-CSS של התחנות כדי שיתאים לפאנל */
    #stations-panel header { position: sticky; top: 0; width: 100%; z-index: 100; }
    #search-container { position: absolute; top: 60px; width: 95%; left: 2.5%; transform: none; }
    #search-overlay { position: absolute; }
  </style>
</head>
<body>

  <button id="modeToggle" onclick="toggleDualMode()">
    <span class="material-symbols-outlined">view_sidebar</span>
    <span id="modeText">מצב כפול</span>
  </button>

  <div id="main-container">
    <div id="stations-panel">
        <div id="stations-panel-content">
            <div id="search-overlay"></div>
            <div id="search-container">
                <input type="text" id="search-input" placeholder="חיפוש תחנה..." />
                <div id="search-results"></div>
            </div>

            <header>
                <button id="refresh-btn" onclick="triggerRefresh()">
                    <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                </button>
                <div id="scroll-area"></div>
            </header>

            <div id="content"></div>
        </div>
    </div>

    <div id="map-wrapper">
        <div id="map">
            <button id="locateMeBtn" title="המיקום שלי">📍</button>
        </div>
        
        <div id="bottomSheet">
            <div id="dragHandleArea"><div class="handle-bar"></div></div>
            <div id="routesContainer"></div>
            <div class="footer-note-global">המיקום מוערך ע"י המערכת • KavNav</div>
        </div>
    </div>
  </div>

  <script>
    window.APP_ENVIRONMENT = 'scriptable';
    window.IS_BROWSER = false;

    // פונקציית החלפת מצבים
    function toggleDualMode() {
      const body = document.body;
      const text = document.getElementById('modeText');
      
      if (body.classList.contains('dual-mode')) {
        body.classList.remove('dual-mode');
        text.innerText = 'מצב כפול';
      } else {
        body.classList.add('dual-mode');
        text.innerText = 'מפה בלבד';
      }
      
      // עדכון גודל המפה לאחר סיום האנימציה
      setTimeout(() => {
        if (window.mapInstance) window.mapInstance.invalidateSize();
      }, 350);
    }
  </script>

  <script>
    ${mapJs}
  </script>

  <script>
    // נעטוף בפונקציה כדי למנוע התנגשויות משתנים גלובליים אם יש
    (function() {
        ${stationsJs}
    })();
  </script>

</body>
</html>`;
};
