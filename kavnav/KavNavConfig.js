// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: green; icon-glyph: magic;

// KavNavConfig - קובץ תצורה משותף

// זיהוי סביבה
if (typeof window !== 'undefined' && typeof window.IS_SCRIPTABLE === 'undefined') {
  window.IS_SCRIPTABLE = typeof FileManager !== 'undefined';
  window.IS_BROWSER = !window.IS_SCRIPTABLE;
}
var IS_SCRIPTABLE = typeof window !== 'undefined' ? window.IS_SCRIPTABLE : (typeof FileManager !== 'undefined');
var IS_BROWSER = typeof window !== 'undefined' ? window.IS_BROWSER : false;

var config = {
  // URLs
  BASE_URL: "https://kavnav.com/api",
  PROXY_URL: "https://script.google.com/macros/s/AKfycbxKfWtTeeoOJCoR_WD4JQhvDGHcE3j82tVHVQXqElwL9NVO9ourZxSHTA20GoBJKfmiLw/exec?url=",
  
  // GitHub Resources
  GITHUB_RAW_URL: "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/main/kavnav/",
  STOPS_JSON_URL: "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/refs/heads/main/data/stops.json",
  
  // הגדרות עדכון
  UPDATE_EVERY_HOURS: 12,
  
  // רשימת המודולים להורדה (עבור Loader)
  MODULE_FILES: [
    "KavNavConfig.js",
    "KavNavHelpers.js",
    "KavNavAPI.js",
    "KavNavUI.js",
    "KavNavSearch.js",
    "KavNavLoader.js", // חשוב: ה-Loader עצמו ברשימה לעדכונים עתידיים
    "KavNavMain.js",
    "web/style.css",
    "web/app.js"
  ],

  // לוגיקה
  SEARCH_RADIUS: 500,
  MAX_STATIONS: 5,
  LOOKAHEAD_MINUTES: 60,
  REFRESH_INTERVAL_MS: 10000,
  SCHEDULE_CACHE_TTL_MS: 120000,
  SUMMARY_CACHE_TTL_MS: 3600000,
  
  IS_SCRIPTABLE,
  IS_BROWSER
};

if (IS_SCRIPTABLE) {
  module.exports = config;
} else {
  window.KavNavConfig = config;
}
