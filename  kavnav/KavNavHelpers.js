// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: magic;
// KavNavHelpers

module.exports.formatDate = function(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date - offset).toISOString().slice(0, 10);
};

module.exports.getMinutesDiff = function(targetDate) {
  return Math.round((targetDate - new Date()) / 60000);
};

module.exports.parseTimeStr = function(timeStr, dateRef) {
  const [h, m, s] = timeStr.split(":").map(Number);
  const d = new Date(dateRef);
  d.setHours(h, m, s || 0, 0);
  return d;
};

module.exports.sleep = function(ms) {
  return new Promise((resolve) => Timer.schedule(ms / 1000, false, resolve));
};

module.exports.getDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
