// utils.js
// פונקציות עזר כלליות

module.exports.isoDateTodayLocal = function() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const config = (typeof importModule !== "undefined")
  ? importModule("config")
  : (typeof require !== "undefined" ? require("./config") : { APP_MODE: "local" });

function browserLikeHeaders() {
  return {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };
}

module.exports.browserLikeHeaders = browserLikeHeaders;

/**
 * fetchJson(url)
 * - ב-Scriptable: קריאה ישירה עם headers "דפדפן" + parse ידני (כדי לקבל שגיאה טובה אם חוזר HTML/חסימה)
 * - ב-LOCAL (דפדפן): שולחים דרך PROXY_URL כדי להימנע מחסימות/CORS
 */
module.exports.fetchJson = async function(url) {
  // --- אם רצים ב-HTML מקומי → שליחת הבקשה דרך הפרוקסי ---
  if (config.APP_MODE === "local" && config.PROXY_URL) {
    const proxy = `${config.PROXY_URL}?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxy, {
      method: "GET",
      headers: browserLikeHeaders(),
    });
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Proxy returned non-JSON (status ${r.status}). First 200 chars: ${text.slice(0, 200)}`);
    }
  }

  // --- Scriptable ---
  const req = new Request(url);
  req.method = "GET";
  req.headers = Object.assign({}, browserLikeHeaders());
  req.timeoutInterval = 20;

  // loadJSON לפעמים "בולע" שגיאות/מחזיר מסר לא ברור – לכן אנחנו עושים loadString + JSON.parse
  const text = await req.loadString();
  try {
    return JSON.parse(text);
  } catch {
    const hint = text && text.trim().startsWith("<") ? " (looks like HTML – maybe blocked or server error)" : "";
    throw new Error(`Non-JSON response${hint}. URL=${url}. First 300 chars: ${String(text).slice(0, 300)}`);
  }
};

module.exports.getDeviceLocation = async function() {
  try {
    Location.setAccuracyToBest();
    const loc = await Location.current();
    return { lat: loc.latitude, lon: loc.longitude };
  } catch (e) {
    console.error("Failed getting device location:", e);
    return { lat: null, lon: null };
  }
};

// fallback location דרך השרת שלך (אם יש)
module.exports.fallbackLocation = async function() {
  if (!config.LOCATION_FALLBACK_URL) {
    return { lat: null, lon: null, lastUpdate: "לא הוגדר" };
  }
  try {
    const req = new Request(config.LOCATION_FALLBACK_URL);
    req.method = "GET";
    req.headers = Object.assign({}, browserLikeHeaders());
    req.timeoutInterval = 20;

    const text = await req.loadString();
    let res;
    try {
      res = JSON.parse(text);
    } catch {
      throw new Error(`Fallback returned non-JSON. First 300 chars: ${text.slice(0, 300)}`);
    }

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