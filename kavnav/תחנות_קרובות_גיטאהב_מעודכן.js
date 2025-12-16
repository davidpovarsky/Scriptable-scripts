// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: magic;
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: magic;

/* ===================== GITHUB BOOTSTRAP (AUTO-DOWNLOAD MODULES) ===================== */

// 🔧 עדכן רק אם הריפו/סניף/נתיב שונים
const REPO_RAW_BASE = "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/main/kavnav/";
const LOCAL_SUBFOLDER = "kavnav";

// אילו מודולים להוריד/לעדכן
const MODULE_FILES = [
  "KavNavConfig.js",
  "KavNavHelpers.js",
  "KavNavAPI.js",
  "KavNavUI.js",
];

// כל כמה זמן לבדוק עדכון (כדי לא להוריד כל ריצה)
const UPDATE_EVERY_HOURS = 12;

const fm = FileManager.iCloud();
const docsDir = fm.documentsDirectory();
const localDir = fm.joinPath(docsDir, LOCAL_SUBFOLDER);

async function ensureDir(path) {
  if (!fm.fileExists(path)) fm.createDirectory(path, true);
}

function hoursSince(d) {
  return (Date.now() - d.getTime()) / (1000 * 60 * 60);
}

async function maybeMigrateTxtToJs(fileJsPath) {
  // אם בטעות שמרת בעבר כ־.txt (כמו שציינת), ננסה “להציל”:
  // KavNavConfig.txt -> KavNavConfig.js
  const fileTxtPath = fileJsPath.replace(/\.js$/i, ".txt");
  if (!fm.fileExists(fileJsPath) && fm.fileExists(fileTxtPath)) {
    // ודא זמין מקומית (iCloud)
    await fm.downloadFileFromiCloud(fileTxtPath);
    const content = fm.readString(fileTxtPath);
    fm.writeString(fileJsPath, content);
  }
}

async function shouldUpdate(filePath) {
  if (!fm.fileExists(filePath)) return true;
  const m = fm.modificationDate(filePath);
  if (!m) return true;
  return hoursSince(m) >= UPDATE_EVERY_HOURS;
}

async function downloadToFile(url, filePath) {
  const req = new Request(url);
  req.timeoutInterval = 30;
  const txt = await req.loadString();
  if (!txt || txt.trim().length < 10) {
    throw new Error("Downloaded file looks empty: " + url);
  }
  fm.writeString(filePath, txt);
}

async function ensureKavNavModules() {
  await ensureDir(localDir);

  for (const fileName of MODULE_FILES) {
    const localPath = fm.joinPath(localDir, fileName);

    // קודם “הצלת txt” אם קיים
    await maybeMigrateTxtToJs(localPath);

    // אם צריך עדכון – הורד מה־GitHub
    if (await shouldUpdate(localPath)) {
      const url = REPO_RAW_BASE + fileName;
      try {
        await downloadToFile(url, localPath);
        // console.log("✅ Updated: " + fileName);
      } catch (e) {
        // אם כבר יש קובץ מקומי ישן – נעדיף להמשיך איתו ולא להפיל הכל
        if (!fm.fileExists(localPath)) throw e;
        console.log("⚠️ Failed to update " + fileName + " using cached local copy. Error: " + e);
      }
    }
  }
}

// חובה לפני importModule
await ensureKavNavModules();

/* ===================== IMPORTS ===================== */

const Config = importModule("kavnav/KavNavConfig");
const Helpers = importModule("kavnav/KavNavHelpers");
const API = importModule("kavnav/KavNavAPI");
const UI = importModule("kavnav/KavNavUI");

/* ===================== STATE ===================== */

// אנחנו שומרים על State דינמי בקובץ הראשי
let STATE = {
  stops: [],
  currentLoc: null,
  stopLoop: false,
  isDirectMode: false,
  mainLoopRunning: false,
  // כדי לאפשר שינוי פרמטרים תוך כדי ריצה
  radius: Config.SEARCH_RADIUS,
  maxStops: Config.MAX_STATIONS
};

/* ===================== CONTROLLER LOGIC ===================== */

async function main() {
  const wv = new WebView();
  await wv.loadHTML(UI.buildHTML());

  wv.shouldAllowRequest = (req) => {
    if (req.url.startsWith("kavnav://")) {
      const cmd = req.url.replace("kavnav://", "");
      handleCommand(cmd, wv);
      return false;
    }
    return true;
  };

  const params = args.shortcutParameter || {};
  let directCodes = null;

  if (params.stopCodes) {
    directCodes = String(params.stopCodes).split(",").map(s => s.trim());
  } else if (typeof params === "string" && params.match(/^\d+(,\d+)*$/)) {
    directCodes = params.split(",");
  }

  if (directCodes && directCodes.length > 0) {
    STATE.isDirectMode = true;
    initDirectMode(wv, directCodes);
  } else {
    STATE.isDirectMode = false;
    initLocationMode(wv);
  }

  await wv.present(true);
}

async function handleCommand(cmd, wv) {
  if (cmd === "refreshLocation") {
    STATE.stopLoop = true;
    await Helpers.sleep(500);
    STATE.stopLoop = false;
    STATE.stops = [];
    STATE.isDirectMode = false;
    // איפוס רדיוס
    STATE.radius = Config.SEARCH_RADIUS;
    STATE.maxStops = Config.MAX_STATIONS;

    await wv.evaluateJavaScript(`window.resetUI("מחפש מיקום מחדש...")`);
    initLocationMode(wv);
  }

  if (cmd === "loadMore") {
    if (STATE.isDirectMode) {
      const a = new Alert();
      a.title = "מצב מק\"ט ידני";
      a.message = "האם לעבור לחיפוש לפי מיקום?";
      a.addAction("כן");
      a.addCancelAction("ביטול");
      if (await a.presentAlert() === 0) handleCommand("refreshLocation", wv);
      return;
    }
    STATE.radius += 500;
    STATE.maxStops += 5;

    if (STATE.currentLoc) {
      const moreStops = await API.findNearbyStops(
        STATE.currentLoc.lat,
        STATE.currentLoc.lon,
        STATE.stops,
        STATE.maxStops,
        STATE.radius
      );
      moreStops.forEach(s => STATE.stops.push(s));
      const js = `window.addStops(${JSON.stringify(moreStops)}, false)`;
      await wv.evaluateJavaScript(js);
      updateLoop(wv, moreStops);
    }
  }
}

async function initDirectMode(wv, codes) {
  const stops = codes.map(c => ({ name: "טוען...", stopCode: c, distance: 0 }));
  STATE.stops = stops;
  await wv.evaluateJavaScript(`window.addStops(${JSON.stringify(stops)}, true)`);
  updateLoop(wv, stops);
}

async function initLocationMode(wv) {
  const loc = await API.getLocation();
  if (!loc) {
    await wv.evaluateJavaScript(`window.resetUI("שגיאה בקבלת מיקום")`);
    return;
  }
  STATE.currentLoc = loc;
  await wv.evaluateJavaScript(`document.getElementById("msg-text").innerText = "מחפש תחנות..."`);

  const stops = await API.findNearbyStops(loc.lat, loc.lon, [], STATE.maxStops, STATE.radius);
  if (stops.length === 0) {
    await wv.evaluateJavaScript(`window.resetUI("לא נמצאו תחנות בסביבה")`);
    return;
  }

  STATE.stops = stops;
  await wv.evaluateJavaScript(`window.addStops(${JSON.stringify(stops)}, true)`);
  updateLoop(wv, stops);
}

async function updateLoop(wv, stopsToUpdate) {
  const fetchAndSend = async (stopCode) => {
    try {
      const data = await API.getStopData(stopCode);
      if (data.name && STATE.isDirectMode) {
        wv.evaluateJavaScript(`window.updateStopName("${stopCode}", "${data.name}")`).catch(()=>{});
      }
      await wv.evaluateJavaScript(`window.updateData("${stopCode}", ${JSON.stringify(data)})`);
    } catch (e) {
      console.log(`Error ${stopCode}: ${e}`);
    }
  };

  for (const s of stopsToUpdate) {
    if (STATE.stopLoop) return;
    await fetchAndSend(s.stopCode);
  }

  if (STATE.mainLoopRunning) return;
  STATE.mainLoopRunning = true;

  while (!STATE.stopLoop) {
    await Helpers.sleep(Config.REFRESH_INTERVAL_MS);
    for (const s of [...STATE.stops]) {
      if (STATE.stopLoop) break;
      await fetchAndSend(s.stopCode);
    }
  }
  STATE.mainLoopRunning = false;
}

await main();
Script.complete();