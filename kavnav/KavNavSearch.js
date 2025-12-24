// KavNavSearch.js - מודול חיפוש תחנות

var IS_SCRIPTABLE = typeof window !== 'undefined' ? window.IS_SCRIPTABLE : (typeof FileManager !== 'undefined');
var IS_BROWSER = typeof window !== 'undefined' ? window.IS_BROWSER : false;

var Config, Loader;

if (IS_SCRIPTABLE) {
  Config = importModule('kavnav/KavNavConfig');
  Loader = importModule('kavnav/KavNavLoader');
} else {
  if (typeof window.KavNavConfig !== 'undefined') Config = window.KavNavConfig;
  if (typeof window.KavNavLoader !== 'undefined') Loader = window.KavNavLoader;
}

// ===============================
// לוגיקת חיפוש
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
    if (stopName === term) score += 1000;
    else if (stopName.startsWith(term)) score += 500;
    else if (stopName.includes(term)) score += 100;

    if (stopCode === term) score += 800;
    else if (stopCode.startsWith(term)) score += 400;
    else if (stopCode.includes(term)) score += 80;

    if (stopDesc.includes(term)) score += 50;

    if (stopId === term) score += 600;
    else if (stopId.includes(term)) score += 60;
  });

  return score;
}

// הפונקציה כעת פשוטה וקוראת ל-Loader
async function loadStopsData() {
  return await Loader.loadStopsData();
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
    .slice(0, 20);

  return results;
}

if (IS_SCRIPTABLE) {
  module.exports = {
    loadStopsData,
    searchStops
  };
} else {
  window.KavNavSearch = {
    loadStopsData,
    searchStops
  };
}
