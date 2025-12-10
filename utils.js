// utils.js
// פונקציות עזר כלליות

module.exports.isoDateTodayLocal = function() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const config = importModule("config");

module.exports.fetchJson = async function(url) {

  // --- אם רצים ב-HTML מקומי → שליחת הבקשה דרך הפרוקסי ---
  if (config.APP_MODE === "local") {
    const proxyUrl = config.PROXY_URL + "?url=" + encodeURIComponent(url);
    const req = new Request(proxyUrl);
    req.timeoutInterval = 20;
    return await req.loadJSON();
  }

  // --- Scriptable רגיל ---
  const req = new Request(url);
  req.timeoutInterval = 20;
  return await req.loadJSON();
};

module.exports.sleep = function(ms) {
  return new Promise((resolve) => Timer.schedule(ms / 1000, false, resolve));
};
module.exports.loadFallbackLocation = async function () {
  const url = "https://owntracks-server.fly.dev/last";

  try {
    const req = new Request(url);
    req.timeoutInterval = 10;
    const res = await req.loadJSON();

    return {
      lat: res.lat ?? null,
      lon: res.lon ?? null,
      lastUpdate: res.tst
        ? new Date(res.tst * 1000).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })
        : "לא ידוע"
    };
  } catch (e) {
    console.error("Fallback location failed:", e);
    return { lat: null, lon: null, lastUpdate: "שגיאה" };
  }
};
