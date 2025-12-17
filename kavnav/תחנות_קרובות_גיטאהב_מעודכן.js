// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: magic;

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
  "KavNavSearch.js"
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
  const fileTxtPath = fileJsPath.replace(/\.js$/i, ".txt");
  if (!fm.fileExists(fileJsPath) && fm.fileExists(fileTxtPath)) {
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
    await maybeMigrateTxtToJs(localPath);

    if (await shouldUpdate(localPath)) {
      const url = REPO_RAW_BASE + fileName;
      try {
        await downloadToFile(url, localPath);
      } catch (e) {
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
const Search = importModule("kavnav/KavNavSearch");

/* ===================== STATE ===================== */

let STATE = {
  stops: [],
  currentLoc: null,
  stopLoop: false,
  isDirectMode: false,
  mainLoopRunning: false,
  radius: Config.SEARCH_RADIUS,
  maxStops: Config.MAX_STATIONS,
  activeStopCode: null,
  isSearchMode: false,
  searchSelectedStop: null
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
  if (cmd.startsWith("setActiveStop/")) {
    const code = cmd.split("/")[1];
    STATE.activeStopCode = code;
    return;
  }

  if (cmd.startsWith("search/")) {
    const query = decodeURIComponent(cmd.split("/")[1]);
    const results = await Search.searchStops(query);
    await wv.evaluateJavaScript(`window.displaySearchResults(${JSON.stringify(results)})`);
    return;
  }

  if (cmd.startsWith("selectSearchStop/")) {
    const parts = cmd.split("/");
    const stopCode = parts[1];
    const lat = parseFloat(parts[2]);
    const lon = parseFloat(parts[3]);
    
    STATE.stopLoop = true;
    await Helpers.sleep(500);
    STATE.stopLoop = false;
    STATE.stops = [];
    STATE.isSearchMode = true;
    STATE.searchSelectedStop = { stopCode, lat, lon };
    STATE.radius = Config.SEARCH_RADIUS;
    STATE.maxStops = Config.MAX_STATIONS;
    STATE.activeStopCode = null;
    
    await wv.evaluateJavaScript(`window.resetUI("טוען תחנות קרובות...")`);
    initSearchLocationMode(wv, lat, lon, stopCode);
    return;
  }

  if (cmd === "refreshLocation") {
    STATE.stopLoop = true;
    await Helpers.sleep(500);
    STATE.stopLoop = false;
    STATE.stops = [];
    STATE.isDirectMode = false;
    STATE.isSearchMode = false;
    STATE.searchSelectedStop = null;
    STATE.radius = Config.SEARCH_RADIUS;
    STATE.maxStops = Config.MAX_STATIONS;
    STATE.activeStopCode = null;

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

    const loc = STATE.isSearchMode ? STATE.searchSelectedStop : STATE.currentLoc;
    if (loc) {
      const moreStops = await API.findNearbyStops(
        loc.lat,
        loc.lon,
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
  
  if (stops.length > 0) STATE.activeStopCode = stops[0].stopCode;
  
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
  
  if (stops.length > 0) STATE.activeStopCode = stops[0].stopCode;

  await wv.evaluateJavaScript(`window.addStops(${JSON.stringify(stops)}, true)`);
  updateLoop(wv, stops);
}

async function initSearchLocationMode(wv, lat, lon, selectedStopCode) {
  await wv.evaluateJavaScript(`document.getElementById("msg-text").innerText = "מחפש תחנות קרובות..."`);

  const stops = await API.findNearbyStops(lat, lon, [], STATE.maxStops, STATE.radius);
  
  const selectedIndex = stops.findIndex(s => s.stopCode === selectedStopCode);
  if (selectedIndex > 0) {
    const selectedStop = stops.splice(selectedIndex, 1)[0];
    stops.unshift(selectedStop);
  } else if (selectedIndex === -1) {
    stops.unshift({ name: "טוען...", stopCode: selectedStopCode, distance: 0 });
  }
  
  if (stops.length === 0) {
    await wv.evaluateJavaScript(`window.resetUI("לא נמצאו תחנות בסביבה")`);
    return;
  }
  
  STATE.stops = stops;
  STATE.activeStopCode = selectedStopCode;

  await wv.evaluateJavaScript(`window.addStops(${JSON.stringify(stops)}, true)`);
  updateLoop(wv, stops);
}

async function updateLoop(wv, stopsToUpdate) {
  const fetchAndSend = async (stopCode) => {
    try {
      const data = await API.getStopData(stopCode);
      if (data.name && (STATE.isDirectMode || STATE.isSearchMode)) {
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
    
    if (STATE.activeStopCode) {
      if (STATE.stopLoop) break;
      await fetchAndSend(STATE.activeStopCode);
    }
  }
  STATE.mainLoopRunning = false;
}

await main();
Script.complete();