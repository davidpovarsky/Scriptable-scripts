// config.js
// קונפיגורציה משותפת לכל הפרויקט

// זיהוי סביבה
const IS_SCRIPTABLE = typeof FileManager !== 'undefined';
const IS_BROWSER = !IS_SCRIPTABLE;

module.exports = {
  // Environment
  APP_MODE: IS_SCRIPTABLE ? "scriptable" : "local",
  IS_SCRIPTABLE,
  IS_BROWSER,
  
  // API Endpoints
  API_BASE: "https://kavnav.com/api",
  PROXY_URL: "https://script.google.com/macros/s/AKfycbxKfWtTeeoOJCoR_WD4JQhvDGHcE3j82tVHVQXqElwL9NVO9ourZxSHTA20GoBJKfmiLw/exec",
  STOPS_JSON_URL: "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/refs/heads/main/data/stops.json",
  
  // Timing
  REFRESH_INTERVAL_MS: 10000, // רענון זמן אמת כל 10 שניות
  SCHEDULE_CACHE_TTL_MS: 120000, // Cache לזמנים מתוכננים - 2 דקות
  SUMMARY_CACHE_TTL_MS: 3600000, // Cache לסיכום תחנה - שעה
  
  // Map & Routes
  DEFAULT_ROUTES: [
    { routeId: 30794 },
    { routeId: 18086 },
  ],
  
  // Stations
  SEARCH_RADIUS: 500, // רדיוס חיפוש תחנות במטרים
  MAX_STATIONS: 5, // מקסימום תחנות להצגה
  LOOKAHEAD_MINUTES: 60, // כמה זמן קדימה להציג
  
  // UI Modes
  VIEW_MODES: {
    BOTH: 'both', // מפה + תחנות (רק במסכים גדולים)
    MAP_ONLY: 'map', // מפה בלבד
    STATIONS_ONLY: 'stations' // תחנות בלבד
  },
  
  // צבעי מפעילים
  OPERATOR_COLORS: {
    "5": "#3868A7", "31": "#3868A7", "32": "#3868A7", // דן
    "3": "#218563", // אגד
    "6": "#009d43", // אופניבוס
    "40": "#aa131f", // יונייטד טורס
    "4": "#9aca3c", "25": "#9aca3c", // אפיקים
    "15": "#F3AD44", // מטרופולין
    "16": "#cdcdcd", // סופרבוס
    "18": "#99ca3c", // קווים
    "20": "#e28a07", // כרמלית
    "7": "#e0e1e3", "14": "#e0e1e3", "33": "#e0e1e3", // נתיב אקספרס
    "8": "#ad1b1c", // גבי טורס
    "34": "#78be99", // תנופה
    "35": "#e0e1e3", "37": "#df8430", "38": "#df8430", // אקסטרה
    "98": "#f2d03f", "93": "#f2d03f", "91": "#f2d03f", "97": "#f2d03f", // מוניות שירות
    "21": "#bf4000", "22": "#bf4000", // קפיר
    "24": "#6fa421", // גולן
    "49": "#ffffff", "42": "#ffffff", // מקומי
    "135": "#8db7e1" // דרך אגד
  },

  getOperatorColor: function(operatorId, apiColor) {
    const key = operatorId != null ? String(operatorId) : "";
    if (key && this.OPERATOR_COLORS[key]) return this.OPERATOR_COLORS[key];
    if (apiColor && typeof apiColor === "string") return apiColor;
    return null;
  }
};