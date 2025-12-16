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

const IS_SCRIPTABLE = typeof window !== 'undefined' ? window.IS_SCRIPTABLE : (typeof FileManager !== 'undefined');
const IS_BROWSER = typeof window !== 'undefined' ? window.IS_BROWSER : false;

// ===============================
// הגדרות כלליות
// ===============================
const config = {
  BASE_URL: "https://kavnav.com/api",
  PROXY_URL: "https://script.google.com/macros/s/AKfycbxKfWtTeeoOJCoR_WD4JQhvDGHcE3j82tVHVQXqElwL9NVO9ourZxSHTA20GoBJKfmiLw/exec?url=",
  
  SEARCH_RADIUS: 500,
  MAX_STATIONS: 5,
  LOOKAHEAD_MINUTES: 60,
  REFRESH_INTERVAL_MS: 10000, // רענון כל 10 שניות (זמן אמת)

  // Cache לזמנים "מתוכננים" ולסיכום תחנה
  SCHEDULE_CACHE_TTL_MS: 120000, // 2 דקות
  SUMMARY_CACHE_TTL_MS: 3600000,  // שעה
  
  // מידע על הסביבה
  IS_SCRIPTABLE,
  IS_BROWSER
};

// ===============================
// Export לפי סביבה
// ===============================
if (IS_SCRIPTABLE) {
  // Scriptable - export כמודול
  module.exports = config;
} else {
  // Browser - export כמשתנה גלובלי
  window.KavNavConfig = config;
}
