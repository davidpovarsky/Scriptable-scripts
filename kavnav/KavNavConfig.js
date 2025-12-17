// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: green; icon-glyph: magic;

// KavNavConfig - קובץ תצורה משותף ל-Scriptable ודפדפן

// ===============================
// זיהוי סביבה (מוגדר פעם אחת בלבד)
// ===============================
if (typeof window !== 'undefined' && typeof window.IS_SCRIPTABLE === 'undefined') {
  window.IS_SCRIPTABLE = typeof FileManager !== 'undefined';
  window.IS_BROWSER = !window.IS_SCRIPTABLE;
}

// שימוש ישיר במשתנים - ללא const!
var IS_SCRIPTABLE = typeof window !== 'undefined' ? window.IS_SCRIPTABLE : (typeof FileManager !== 'undefined');
var IS_BROWSER = typeof window !== 'undefined' ? window.IS_BROWSER : false;

// ===============================
// הגדרות כלליות
// ===============================
var config = {
  BASE_URL: "https://kavnav.com/api",
  PROXY_URL: "https://script.google.com/macros/s/AKfycbxKfWtTeeoOJCoR_WD4JQhvDGHcE3j82tVHVQXqElwL9NVO9ourZxSHTA20GoBJKfmiLw/exec?url=",
  
  // כתובת קובץ התחנות לחיפוש
  STOPS_FILE_URL: "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/refs/heads/main/data/stops.json",

  SEARCH_RADIUS: 500,
  MAX_STATIONS: 5,
  LOOKAHEAD_MINUTES: 60,
  REFRESH_INTERVAL_MS: 10000, // רענון כל 10 שניות (זמן אמת)
  
  // הגדרות תצוגה
  SHOW_ZERO_MINUTES: true
};

// ייצוא ב-Scriptable
if (IS_SCRIPTABLE && typeof module !== 'undefined') {
  module.exports = config;
}

// ייצוא בדפדפן
if (IS_BROWSER) {
  window.KavNavConfig = config;
}
