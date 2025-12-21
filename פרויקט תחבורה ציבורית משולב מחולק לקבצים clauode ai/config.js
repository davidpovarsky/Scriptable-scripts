// config.js
// מכיל את כל הקבועים וההגדרות

// מצב הריצה: "scriptable" או "local"
// זה יוגדר אוטומטית על פי הסביבה
module.exports.APP_MODE = typeof importModule !== 'undefined' ? "scriptable" : "local";

// כתובת הפרוקסי
module.exports.PROXY_URL = "https://script.google.com/macros/s/AKfycbxKfWtTeeoOJCoR_WD4JQhvDGHcE3j82tVHVQXqElwL9NVO9ourZxSHTA20GoBJKfmiLw/exec";
module.exports.API_BASE = "https://kavnav.com/api";
module.exports.REFRESH_INTERVAL_MS = 10000;

// ברירת מחדל למסלולים אם אין התראה
module.exports.DEFAULT_ROUTES = [
  { routeId: 30794 },
  { routeId: 18086 },
];

const OPERATOR_COLORS = {
  "5": "#3868A7", // דן
  "31": "#3868A7", "32": "#3868A7",
  "3": "#218563", // אגד
  "6": "#009d43", // אופניבוס
  "40": "#aa131f", // יונייטד טורס
  "4": "#9aca3c", // אפיקים
  "25": "#9aca3c",
  "15": "#F3AD44", // מטרופולין
  "16": "#cdcdcd", // סופרבוס
  "18": "#99ca3c", // קווים
  "20": "#e28a07", // כרמלית
  "7": "#e0e1e3", "14": "#e0e1e3", // נתיב אקספרס
  "33": "#e0e1e3",
  "8": "#ad1b1c", // גבי טורס
  "34": "#78be99", // תנופה
  "35": "#e0e1e3", "37": "#df8430", "38": "#df8430", // אקסטרה
  "98": "#f2d03f", "93": "#f2d03f", "91": "#f2d03f", "97": "#f2d03f", // מוניות שירות
  "21": "#bf4000", "22": "#bf4000", // קפיר
  "24": "#6fa421", // גולן
  "49": "#ffffff", "42": "#ffffff", // מקומי
  "135": "#8db7e1" // דרך אגד
};

module.exports.getOperatorColor = function(operatorId, apiColor) {
  const key = operatorId != null ? String(operatorId) : "";
  if (key && OPERATOR_COLORS[key]) return OPERATOR_COLORS[key];
  if (apiColor && typeof apiColor === "string") return apiColor;
  return null;
};
