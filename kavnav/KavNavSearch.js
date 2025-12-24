// KavNavSearch.js - מודול חיפוש תחנות

// ===============================
// זיהוי סביבה וטעינת תלויות
// ===============================
var IS_SCRIPTABLE = typeof window !== 'undefined' ? window.IS_SCRIPTABLE : (typeof FileManager !== 'undefined');
var IS_BROWSER = typeof window !== 'undefined' ? window.IS_BROWSER : false;

var Config;

if (IS_SCRIPTABLE) {
  Config = importModule('kavnav/KavNavConfig');
} else {
  if (typeof window.KavNavConfig !== 'undefined') {
    Config = window.KavNavConfig;
  }
}

// ===============================
// Cache בזיכרון
// ===============================
let stopsData = null;
let stopsLoadPromise = null;

// ===============================
// טעינת stops.json (local -> iCloud -> URL + cache local)
// ===============================
async function loadStopsData() {
  if (stopsData) return stopsData;

  if (stopsLoadPromise) return stopsLoadPromise;

  stopsLoadPromise = (async () => {
    try {
      const url = Config.STOPS_JSON_URL;

      // Scriptable: local -> iCloud -> URL (GitHub) -> cache local
      if (IS_SCRIPTABLE) {
        const REL_PATH = 'data/stops.json';

        // 1) Local
        try {
          const fmLocal = FileManager.local();
          const baseLocal = fmLocal.documentsDirectory();
          const localPath = fmLocal.joinPath(baseLocal, REL_PATH);

          if (fmLocal.fileExists(localPath)) {
            const raw = fmLocal.readString(localPath);
            stopsData = JSON.parse(raw);
            return stopsData;
          }
        } catch (e) {
          console.warn('Local stops.json exists but failed to read/parse:', e);
        }

        // 2) iCloud
        try {
          const fmIcloud = FileManager.iCloud();
          const baseIcloud = fmIcloud.documentsDirectory();
          const icloudPath = fmIcloud.joinPath(baseIcloud, REL_PATH);

          if (fmIcloud.fileExists(icloudPath)) {
            await fmIcloud.downloadFileFromiCloud(icloudPath);
            const raw = fmIcloud.readString(icloudPath);
            stopsData = JSON.parse(raw);

            // cache to Local for next time
            try {
              const fmLocal = FileManager.local();
              const baseLocal = fmLocal.documentsDirectory();
              const localDataDir = fmLocal.joinPath(baseLocal, 'data');
              const localPath = fmLocal.joinPath(baseLocal, REL_PATH);

              if (!fmLocal.fileExists(localDataDir)) fmLocal.createDirectory(localDataDir, true);
              fmLocal.writeString(localPath, JSON.stringify(stopsData));
            } catch (e2) {
              console.warn('Could not cache iCloud stops.json to local:', e2);
            }

            return stopsData;
          }
        } catch (e) {
          console.warn('iCloud stops.json check failed:', e);
        }

        // 3) URL (GitHub) + cache Local
        try {
          const req = new Request(url);
          req.timeoutInterval = 30;

          const raw = await req.loadString();
          stopsData = JSON.parse(raw);

          try {
            const fmLocal = FileManager.local();
            const baseLocal = fmLocal.documentsDirectory();
            const localDataDir = fmLocal.joinPath(baseLocal, 'data');
            const localPath = fmLocal.joinPath(baseLocal, REL_PATH);

            if (!fmLocal.fileExists(localDataDir)) fmLocal.createDirectory(localDataDir, true);
            fmLocal.writeString(localPath, JSON.stringify(stopsData));
          } catch (e2) {
            console.warn('Could not save downloaded stops.json to local:', e2);
          }

          return stopsData;
        } catch (e) {
          console.error('Failed to load stops.json from URL:', e);
          stopsLoadPromise = null;
          return [];
        }
      }

      // Browser: fetch מה-URL
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load stops data');
      stopsData = await response.json();
      return stopsData;

    } catch (e) {
      console.error('Error loading stops data:', e);
      stopsLoadPromise = null;
      return [];
    }
  })();

  return stopsLoadPromise;
}

// ===============================
// פונקציית חיפוש חכמה
// ===============================
function normalizeText(text) {
  if (!text) return '';
  return String(text).toLowerCase().trim();
}

function calculateRelevance(stop, searchTerms) {
  const stopName = normalizeText(stop.stopName);
  const stopCode = normalizeText(stop.stopCode);
  const stopDesc = normalizeText(stop.stopDesc);
  const stopId = normalizeText(stop.stopId);

  let score = 0;

  searchTerms.forEach(term => {
    // התאמה מדויקת לשם - ציון גבוה
    if (stopName === term) score += 1000;
    else if (stopName.startsWith(term)) score += 500;
    else if (stopName.includes(term)) score += 100;

    // התאמה מדויקת לקוד
    if (stopCode === term) score += 800;
    else if (stopCode.startsWith(term)) score += 400;
    else if (stopCode.includes(term)) score += 80;

    // התאמה בתיאור
    if (stopDesc.includes(term)) score += 50;

    // התאמה ב-ID
    if (stopId === term) score += 600;
    else if (stopId.includes(term)) score += 60;
  });

  return score;
}

async function searchStops(query) {
  if (!query || query.trim().length === 0) return [];

  const stops = await loadStopsData();
  if (!stops || stops.length === 0) return [];

  const searchTerms = normalizeText(query).split(/\s+/).filter(t => t.length > 0);

  const results = stops
    .map(stop => ({
      ...stop,
      relevance: calculateRelevance(stop, searchTerms)
    }))
    .filter(stop => stop.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 20); // הגבלה ל-20 תוצאות

  return results;
}

// ===============================
// Export לפי סביבה
// ===============================
if (IS_SCRIPTABLE) {
  module.exports = {
    loadStopsData: loadStopsData,
    searchStops: searchStops
  };
} else {
  window.KavNavSearch = {
    loadStopsData: loadStopsData,
    searchStops: searchStops
  };
}