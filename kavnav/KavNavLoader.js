// KavNavLoader.js - מנהל משאבים מרכזי (הורדות, קבצים, Cache)

var IS_SCRIPTABLE = typeof window !== 'undefined' ? window.IS_SCRIPTABLE : (typeof FileManager !== 'undefined');
var IS_BROWSER = typeof window !== 'undefined' ? window.IS_BROWSER : false;

var Config;
if (IS_SCRIPTABLE) {
  // ב-Scriptable אנחנו מייבאים, אבל בזהירות כי ייתכן וזה הריצה הראשונה
  try { Config = importModule('KavNavConfig'); } catch(e) { console.log("Config not loaded yet in Loader"); }
} else {
  if (typeof window.KavNavConfig !== 'undefined') Config = window.KavNavConfig;
}

// ===============================
// משתנים פנימיים ל-Scriptable
// ===============================
let fm, docsDir, localDir, repoBase;
if (IS_SCRIPTABLE) {
  fm = FileManager.iCloud();
  docsDir = fm.documentsDirectory();
  // נתיב בסיס מקומי
  localDir = fm.joinPath(docsDir, "kavnav");
}

// ===============================
// פונקציות עזר פנימיות
// ===============================
async function _downloadToFile(url, localPath) {
  const req = new Request(url);
  req.timeoutInterval = 30;
  const txt = await req.loadString();
  if (!txt || txt.trim().length < 10) {
    throw new Error("Downloaded file empty or invalid: " + url);
  }
  
  // יצירת תיקיות אם חסרות
  const dir = localPath.substring(0, localPath.lastIndexOf("/"));
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  
  fm.writeString(localPath, txt);
  return txt;
}

function _hoursSince(date) {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

// ===============================
// פונקציות ראשיות (Public)
// ===============================

// 1. עדכון/הורדת כל המודולים (מחליף את ה-Bootstrap הראשי)
async function ensureAllModules() {
  if (!IS_SCRIPTABLE) return; // בדפדפן אין הורדת קבצים
  
  // ודא שתיקייה קיימת
  if (!fm.fileExists(localDir)) fm.createDirectory(localDir, true);

  // טען קונפיגורציה אם חסרה (למקרה של ריצה ראשונה)
  if (!Config) Config = importModule('KavNavConfig');
  
  const files = Config.MODULE_FILES || [];
  const repo = Config.GITHUB_RAW_URL;
  const updateInterval = Config.UPDATE_EVERY_HOURS || 12;

  for (const fileName of files) {
    const localPath = fm.joinPath(localDir, fileName);
    const url = repo + fileName;

    // בדיקה אם צריך לעדכן
    let needUpdate = false;
    if (!fm.fileExists(localPath)) {
      needUpdate = true;
    } else {
      const m = fm.modificationDate(localPath);
      if (!m || _hoursSince(m) > updateInterval) needUpdate = true;
    }

    if (needUpdate) {
      try {
        console.log(`Loader: Downloading ${fileName}...`);
        await _downloadToFile(url, localPath);
        console.log(`Loader: Updated ${fileName}`);
      } catch (e) {
        console.warn(`Loader: Failed to update ${fileName} (${e.message}). Using local.`);
      }
    }
  }
}

// 2. טעינת stops.json (הגיון מאוחד: Local -> iCloud -> URL -> Save Local)
let _stopsCache = null;

async function loadStopsData() {
  if (_stopsCache) return _stopsCache;

  // --- דפדפן ---
  if (IS_BROWSER) {
    const url = Config.STOPS_JSON_URL;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network err');
      _stopsCache = await response.json();
      return _stopsCache;
    } catch (e) {
      console.error("Browser loadStops failed", e);
      return [];
    }
  }

  // --- Scriptable ---
  if (IS_SCRIPTABLE) {
    const REL_PATH = 'data/stops.json';
    const fmLocal = FileManager.local(); // לשימוש ב-Cache מקומי מהיר
    const baseLocalDocs = fmLocal.documentsDirectory();
    const localCachePath = fmLocal.joinPath(fmLocal.joinPath(baseLocalDocs, "kavnav"), REL_PATH);
    
    // א. נסה לקרוא מקומית (Cache מהיר)
    if (fmLocal.fileExists(localCachePath)) {
      try {
        const raw = fmLocal.readString(localCachePath);
        _stopsCache = JSON.parse(raw);
        return _stopsCache;
      } catch(e) { console.warn("Local cache corrupted", e); }
    }

    // ב. נסה לקרוא מ-iCloud (הקובץ "הרשמי" במכשיר)
    const icloudPath = fm.joinPath(localDir, REL_PATH);
    if (fm.fileExists(icloudPath)) {
       try {
         await fm.downloadFileFromiCloud(icloudPath);
         const raw = fm.readString(icloudPath);
         _stopsCache = JSON.parse(raw);
         
         // שמור עותק ל-Cache המקומי לפעם הבאה
         try {
            const lDir = localCachePath.substring(0, localCachePath.lastIndexOf("/"));
            if (!fmLocal.fileExists(lDir)) fmLocal.createDirectory(lDir, true);
            fmLocal.writeString(localCachePath, raw);
         } catch(e){}
         
         return _stopsCache;
       } catch (e) { console.warn("iCloud read failed", e); }
    }

    // ג. הורד מהאינטרנט (GitHub)
    try {
      console.log("Loader: Downloading stops.json from GitHub...");
      const url = Config.STOPS_JSON_URL;
      const jsonStr = await _downloadToFile(url, icloudPath); // שומר ל-iCloud
      _stopsCache = JSON.parse(jsonStr);
      
      // שמור גם ל-Local Cache
      try {
        const lDir = localCachePath.substring(0, localCachePath.lastIndexOf("/"));
        if (!fmLocal.fileExists(lDir)) fmLocal.createDirectory(lDir, true);
        fmLocal.writeString(localCachePath, jsonStr);
      } catch(e){}

      return _stopsCache;
    } catch (e) {
      console.error("All stops methods failed", e);
      return [];
    }
  }
}

// 3. קריאת קובץ טקסט (עבור UI CSS/JS)
function readModuleFile(fileName) {
  if (!IS_SCRIPTABLE) return "";
  try {
    // מניח שקבצי web נמצאים ב-kavnav/web/
    const filePath = fm.joinPath(localDir, "web/" + fileName);
    if (fm.fileExists(filePath)) {
       fm.downloadFileFromiCloud(filePath);
       return fm.readString(filePath);
    }
    // תמיכה לאחור אם הקובץ בתיקייה הראשית
    const rootPath = fm.joinPath(localDir, fileName);
    if (fm.fileExists(rootPath)) {
       fm.downloadFileFromiCloud(rootPath);
       return fm.readString(rootPath);
    }
    return "";
  } catch(e) {
    console.error("Error reading file " + fileName, e);
    return "";
  }
}

// ===============================
// Export
// ===============================
var Loader = {
  ensureAllModules,
  loadStopsData,
  readModuleFile
};

if (IS_SCRIPTABLE) {
  module.exports = Loader;
} else {
  window.KavNavLoader = Loader;
}
