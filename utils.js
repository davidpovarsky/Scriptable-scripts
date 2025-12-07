// utils.js
// פונקציות עזר כלליות

module.exports.isoDateTodayLocal = function() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

module.exports.fetchJson = async function(url) {
  const req = new Request(url);
  req.timeoutInterval = 20;
  return await req.loadJSON();
};

module.exports.sleep = function(ms) {
  return new Promise((resolve) => Timer.schedule(ms / 1000, false, resolve));
};
