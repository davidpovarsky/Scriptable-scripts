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
// Cache לנתוני התחנות
// ===============================
let stopsData = null;
let stopsLoadPromise = null;

// ===============================
// טעינת קובץ התחנות
// ===============================
async function loadStopsData() {
  if (stopsData) return stopsData;
  
  if (stopsLoadPromise) return stopsLoadPromise;
  
  stopsLoadPromise = (async () => {
    try {
      const url = Config.STOPS_JSON_URL;
      
      if (IS_SCRIPTABLE) {
        const req = new Request(url);
        req.timeoutInterval = 30;
        stopsData = await req.loadJSON();
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load stops data');
        stopsData = await response.json();
      }
      
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