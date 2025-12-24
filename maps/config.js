// config.js
// מכיל את כל הקבועים וההגדרות

// מצב הריצה: "scriptable" או "local"
// זה יוגדר אוטומטית על פי הסביבה
module.exports.APP_MODE = typeof importModule !== 'undefined' ? "scriptable" : "local";

// כתובת הפרוקסי
module.exports.PROXY_URL = "https://script.google.com/macros/s/A...CoR_WD4JQhvDGHcE3j82tVHVQXqElwL9NVO9ourZxSHTA20GoBJKfmiLw/exec";
module.exports.API_BASE = "https://";

// ... שאר הקובץ שלך נשאר כמו שהיה ...

// ======================================================
// 🧊 3D Buses (deck.gl)
// ======================================================
// להפעיל/לכבות תלת-מימד לאוטובוסים (מעל Leaflet)
module.exports.ENABLE_DECKGL_3D = true;

// כתובת GLB (חייב RAW ולא blob)
// אם יש לך לינק כזה:
//   https://github.com/.../blob/deckgl-3d/maps/Bus4glb.glb
// תשנה ל-RAW כזה:
//   https://raw.githubusercontent.com/.../deckgl-3d/maps/Bus4glb.glb
module.exports.BUS_MODEL_GLB_URL =
  "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/deckgl-3d/maps/Bus4glb.glb";

// גודל/סקייל של המודל (ככל שגדול יותר - המודל יותר גדול)
module.exports.BUS_MODEL_SIZE_SCALE = 25;

// “גובה” (במטרים) מעל הקרקע - רק כדי להבליט טיפה מעל המפה
module.exports.BUS_MODEL_ELEVATION_METERS = 6;

// הסטה לסיבוב המודל (כי כל מודל מגיע עם ציר קדמי אחר)
module.exports.BUS_MODEL_YAW_OFFSET_DEG = 0;

// זווית מצלמה (pitch) לתחושת תלת-מימד
module.exports.DECK_PITCH_DEG = 50;

// אם יש סטייה בין deck ל-leaflet - אפשר להזיז zoom ב-+/-1
module.exports.DECK_ZOOM_OFFSET = 0;