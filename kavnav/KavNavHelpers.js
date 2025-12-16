// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: magic;

// KavNavHelpers - פונקציות עזר משותפות ל-Scriptable ודפדפן

// ===============================
// זיהוי סביבה (שימוש במשתנים גלובליים)
// ===============================
const IS_SCRIPTABLE = typeof window !== 'undefined' ? window.IS_SCRIPTABLE : (typeof FileManager !== 'undefined');
const IS_BROWSER = typeof window !== 'undefined' ? window.IS_BROWSER : false;

// ===============================
// פונקציות עזר
// ===============================
const helpers = {
  formatDate: function(date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date - offset).toISOString().slice(0, 10);
  },

  getMinutesDiff: function(targetDate) {
    return Math.round((targetDate - new Date()) / 60000);
  },

  parseTimeStr: function(timeStr, dateRef) {
    const [h, m, s] = timeStr.split(":").map(Number);
    const d = new Date(dateRef);
    d.setHours(h, m, s || 0, 0);
    return d;
  },

  sleep: function(ms) {
    if (IS_SCRIPTABLE) {
      // Scriptable - שימוש ב-Timer
      return new Promise((resolve) => Timer.schedule(ms / 1000, false, resolve));
    } else {
      // Browser - שימוש ב-setTimeout רגיל
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  },

  getDistance: function(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
};

// ===============================
// Export לפי סביבה
// ===============================
if (IS_SCRIPTABLE) {
  // Scriptable - export כמודול
  module.exports = helpers;
} else {
  // Browser - export כמשתנה גלובלי
  window.KavNavHelpers = helpers;
}
