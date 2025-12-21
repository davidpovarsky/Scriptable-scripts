// KavNav Loader
// סקריפט זה מוריד את הקבצים העדכניים ומריץ את התוכנה

// --- הגדרות ---
// שנה את הכתובת הזו לתיקייה שבה יושבים קבצי ה-Raw שלך בגיטהאב
const REPO_URL = "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/refs/heads/main/kavnav/";

const FILES = [
  "config.js",
  "utils.js",
  "data.js",
  "view.js",
  "main.js",
  "web/app-bundled.js",
  "web/style-bundled.css"
];

// --- לוגיקת טעינה ---
const fm = FileManager.local();
const cacheDir = fm.documentsDirectory();

async function downloadAndSave(filename) {
  const url = REPO_URL + filename;
  const req = new Request(url);
  
  try {
    const content = await req.loadString();
    const path = fm.joinPath(cacheDir, filename);
    
    // אם זה בתוך תיקייה – ניצור את התיקייה קודם
    const parts = filename.split("/");
    if (parts.length > 1) {
      let currentPath = cacheDir;
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = fm.joinPath(currentPath, parts[i]);
        if (!fm.fileExists(currentPath)) {
          fm.createDirectory(currentPath, true);
        }
      }
    }
    
    fm.writeString(path, content);
    console.log(`✅ Updated: ${filename}`);
  } catch (e) {
    console.error(`❌ Failed to download ${filename}: ${e}`);
  }
}

// 1. הורדת הקבצים העדכניים
console.log("📥 Downloading files...");
await Promise.all(FILES.map(f => downloadAndSave(f)));
console.log("✅ All files downloaded");

// 2. טעינת המודול הראשי והרצה
try {
  const mainModule = importModule('main');
  await mainModule.run(args);
} catch (e) {
  const a = new Alert();
  a.title = "שגיאה בהרצה";
  a.message = String(e);
  await a.present();
}
