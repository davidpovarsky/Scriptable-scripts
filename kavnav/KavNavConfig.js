// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: green; icon-glyph: magic;
// KavNavConfig
module.exports = {
  BASE_URL: "https://kavnav.com/api",
  SEARCH_RADIUS: 500,
  MAX_STATIONS: 5,
  LOOKAHEAD_MINUTES: 60,
  REFRESH_INTERVAL_MS: 10000, // רענון כל 10 שניות (זמן אמת)

  // ✅ חדש: Cache לזמנים "מתוכננים" ולסיכום תחנה
  // ברירת מחדל טובה: לוח זמנים מתוכנן לא צריך להיטען כל 10 שניות.
  SCHEDULE_CACHE_TTL_MS: 120000, // 2 דקות
  SUMMARY_CACHE_TTL_MS: 3600000  // שעה
};