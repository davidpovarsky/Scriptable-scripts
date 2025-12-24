// KavNavUI.js - בניית HTML חכם לפי סביבה

var IS_SCRIPTABLE = typeof window !== 'undefined' ? window.IS_SCRIPTABLE : (typeof FileManager !== 'undefined');
var IS_BROWSER = typeof window !== 'undefined' ? window.IS_BROWSER : false;

var Loader;
if (IS_SCRIPTABLE) {
  Loader = importModule('kavnav/KavNavLoader');
}

function buildHTML() {
  const htmlBody = `
<div id="search-overlay"></div>
<div id="search-container">
  <input type="text" id="search-input" placeholder="חיפוש תחנה לפי מספר או שם..." />
  <div id="search-results"></div>
</div>

<header>
  <button id="refresh-btn" onclick="triggerRefresh()">
    <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </button>
  <div id="scroll-area"></div>
</header>

<div id="content"></div>
`;

  if (IS_SCRIPTABLE) {
    // שימוש ב-Loader לקריאת הקבצים
    const cssContent = Loader.readModuleFile("style.css");
    const jsContent = Loader.readModuleFile("app.js");
    
    return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"/>
<style>${cssContent}</style>
</head>
<body>
${htmlBody}
<script>${jsContent}</script>
</body>
</html>`;
  } else {
    // Browser
    return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="web/style.css">
</head>
<body>
${htmlBody}
<script src="KavNavConfig.js"></script>
<script src="KavNavLoader.js"></script>
<script src="KavNavHelpers.js"></script>
<script src="KavNavSearch.js"></script>
<script src="KavNavAPI.js"></script>
<script src="web/app.js"></script>
<script src="KavNavMain.js"></script>
</body>
</html>`;
  }
}

if (IS_SCRIPTABLE) {
  module.exports = { buildHTML };
} else {
  window.KavNavUI = { buildHTML };
}
