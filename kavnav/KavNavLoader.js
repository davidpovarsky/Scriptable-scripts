// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: magic;

// KavNavLoader.js - ריכוז כל ההורדות (מודולים + web + data/stops.json) לקובץ אחד

const REPO_RAW_BASE = "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/main/kavnav/";
const LOCAL_SUBFOLDER = "kavnav";

// קבצים של הפרויקט (מודולים + web)
const MODULE_FILES = [
  "KavNavConfig.js",
  "KavNavHelpers.js",
  "KavNavAPI.js",
  "KavNavUI.js",
  "KavNavSearch.js",
  "web/style.css",
  "web/app.js"
];

// כל כמה זמן לבדוק עדכון (0 = תמיד)
const UPDATE_EVERY_HOURS = 12;

const fm = FileManager.iCloud();
const docsDir = fm.documentsDirectory();
const localDir = fm.joinPath(docsDir, LOCAL_SUBFOLDER);

function hoursSince(d) {
  return (Date.now() - d.getTime()) / (1000 * 60 * 60);
}

async function ensureDir(path) {
  if (!fm.fileExists(path)) fm.createDirectory(path, true);
}

async function ensureParentDir(filePath) {
  const parent = filePath.split("/").slice(0, -1).join("/");
  if (parent && !fm.fileExists(parent)) fm.createDirectory(parent, true);
}

async function maybeMigrateTxtToJs(filePath) {
  // רק עבור קבצי JS, אם שמורים אצלך ב-.txt
  if (!/\.js$/i.test(filePath)) return;

  const fileTxtPath = filePath.replace(/\.js$/i, ".txt");
  if (!fm.fileExists(filePath) && fm.fileExists(fileTxtPath)) {
    await fm.downloadFileFromiCloud(fileTxtPath);
    const content = fm.readString(fileTxtPath);
    await ensureParentDir(filePath);
    fm.writeString(filePath, content);
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
  await ensureParentDir(filePath);
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
        console.log("⬇️ Downloading: " + fileName);
        await downloadToFile(url, localPath);
        console.log("✅ Updated: " + fileName);
      } catch (e) {
        if (!fm.fileExists(localPath)) throw e;
        console.log("⚠️ Failed to update " + fileName + " using cached local copy. Error: " + e);
      }
    } else {
      console.log("⏭️ Skipping " + fileName + " (cached)");
    }
  }
}

/**
 * טעינת stops.json (local -> iCloud -> URL + cache local)
 * זה מרכז את ההורדה שהייתה מפוזרת בתוך KavNavSearch.js
 */
let _stopsData = null;
let _stopsLoadPromise = null;

async function loadStopsData() {
  if (_stopsData) return _stopsData;
  if (_stopsLoadPromise) return _stopsLoadPromise;

  _stopsLoadPromise = (async () => {
    // נטען Config כדי לקבל STOPS_JSON_URL
    let Config;
    try {
      Config = importModule("kavnav/KavNavConfig");
    } catch (e) {
      // אם עוד לא ירד—ננסה לוודא מודולים ואז לטעון
      await ensureKavNavModules();
      Config = importModule("kavnav/KavNavConfig");
    }

    const url = Config.STOPS_JSON_URL;
    const REL_PATH = "data/stops.json";

    // 1) Local
    try {
      const fmLocal = FileManager.local();
      const baseLocal = fmLocal.documentsDirectory();
      const localPath = fmLocal.joinPath(baseLocal, REL_PATH);

      if (fmLocal.fileExists(localPath)) {
        const raw = fmLocal.readString(localPath);
        _stopsData = JSON.parse(raw);
        return _stopsData;
      }
    } catch (e) {
      console.warn("Local stops.json exists but failed to read/parse:", e);
    }

    // 2) iCloud
    try {
      const baseIcloud = fm.documentsDirectory();
      const icloudPath = fm.joinPath(baseIcloud, REL_PATH);

      if (fm.fileExists(icloudPath)) {
        await fm.downloadFileFromiCloud(icloudPath);
        const raw = fm.readString(icloudPath);
        _stopsData = JSON.parse(raw);

        // cache to Local
        try {
          const fmLocal = FileManager.local();
          const baseLocal = fmLocal.documentsDirectory();
          const localDataDir = fmLocal.joinPath(baseLocal, "data");
          const localPath = fmLocal.joinPath(baseLocal, REL_PATH);

          if (!fmLocal.fileExists(localDataDir)) fmLocal.createDirectory(localDataDir, true);
          fmLocal.writeString(localPath, JSON.stringify(_stopsData));
        } catch (e2) {
          console.warn("Could not cache iCloud stops.json to local:", e2);
        }

        return _stopsData;
      }
    } catch (e) {
      console.warn("iCloud stops.json check failed:", e);
    }

    // 3) URL + cache Local
    try {
      const req = new Request(url);
      req.timeoutInterval = 30;
      const raw = await req.loadString();
      _stopsData = JSON.parse(raw);

      try {
        const fmLocal = FileManager.local();
        const baseLocal = fmLocal.documentsDirectory();
        const localDataDir = fmLocal.joinPath(baseLocal, "data");
        const localPath = fmLocal.joinPath(baseLocal, REL_PATH);

        if (!fmLocal.fileExists(localDataDir)) fmLocal.createDirectory(localDataDir, true);
        fmLocal.writeString(localPath, JSON.stringify(_stopsData));
      } catch (e2) {
        console.warn("Could not save downloaded stops.json to local:", e2);
      }

      return _stopsData;
    } catch (e) {
      console.error("Failed to load stops.json from URL:", e);
      _stopsLoadPromise = null;
      return [];
    }
  })();

  return _stopsLoadPromise;
}

module.exports = {
  ensureKavNavModules,
  loadStopsData
};