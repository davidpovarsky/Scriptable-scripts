// utils.js
// פונקציות עזר משותפות

const config = importModule('config');

// ===== תאריכים וזמנים =====
module.exports.isoDateTodayLocal = function() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

// ===== Fetch =====
module.exports.fetchJson = async function(url) {
  // אם רצים ב-HTML מקומי → שליחת הבקשה דרך הפרוקסי
  if (config.APP_MODE === "local") {
    const proxyUrl = config.PROXY_URL + "?url=" + encodeURIComponent(url);
    const req = new Request(proxyUrl);
    req.timeoutInterval = 20;
    return await req.loadJSON();
  }

  // Scriptable רגיל
  const req = new Request(url);
  req.timeoutInterval = 20;
  return await req.loadJSON();
};

// ===== Sleep =====
module.exports.sleep = function(ms) {
  return new Promise((resolve) => Timer.schedule(ms / 1000, false, resolve));
};

// ===== מיקום Fallback =====
module.exports.loadFallbackLocation = async function() {
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

// ===== חישוב מרחק =====
module.exports.getDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371000; // רדיוס כדור הארץ במטרים
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + 
            Math.cos(lat1 * Math.PI / 180) * 
            Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};