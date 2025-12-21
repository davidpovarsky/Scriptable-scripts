// app.js
// תומך גם ב-Scriptable WebView וגם בדפדפן רגיל

let mapInstance = null;
let busLayerGroup = null;
let userLocationMarker = null;
let staticDataStore = new Map();
let routeViews = new Map();
let mapDidInitialFit = false;

// זיהוי סביבת הריצה
const IS_LOCAL = window.APP_ENVIRONMENT === 'local';
const PROXY_URL = "https://script.google.com/macros/s/AKfycbxKfW...CoR_WD4JQhvDGHcE3j82tVHVQXqElwL9NVO9ourZxSHTA20GoBJKfmiLw/exec";

// פונקציית fetch מותאמת לסביבה
async function fetchJson(url) {
...
  } catch (e) {
    console.error("Fetch error:", e);
    throw e;
  }
}

// פונקציית מיקום מותאמת לסביבה
async function getUserLocation() {
  if (IS_LOCAL) {
    // דפדפן רגיל - שימוש ב-Geolocation API
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
...
}

/* =========================================================
   Stops Panel (KavNav - nearby stops + realtime)
   Minimal-intrusion: runs fully client-side inside this page
   ========================================================= */

const SP = {
  radius: 500,
  maxStops: 5,
  lookaheadMin: 60,
  refreshMs: 10000,
  stops: [],
  dataByStop: {},
  activeStop: null,
  loopRunning: false,
  stopLoop: false,
  currentLoc: null,
  summaryCache: new Map(),
  scheduleCache: new Map(),
  realtimeCache: new Map()
};

function spEls() {
  return {
    panel: document.getElementById("stopsPanel"),
    strip: document.getElementById("spStopsStrip"),
    loader: document.getElementById("spLoader"),
    msg: document.getElementById("spMsg"),
    view: document.getElementById("spStopView"),
    title: document.getElementById("spStopTitle"),
    cards: document.getElementById("spCards"),
    empty: document.getElementById("spEmpty"),
    refresh: document.getElementById("spRefreshBtn"),
    close: document.getElementById("spCloseBtn"),
    modeToggle: document.getElementById("modeToggle"),
    bubbleLabel: document.querySelector("#modeToggle .bubble-label")
  };
}

function spSetMode(mode) {
  const body = document.body;
  body.classList.toggle("mode-dual", mode === "dual");
  body.classList.toggle("mode-map", mode === "map");
  body.dataset.mode = mode;

  try { localStorage.setItem("kavnav_ui_mode", mode); } catch (_) {}

  const { bubbleLabel } = spEls();
  if (bubbleLabel) bubbleLabel.textContent = (mode === "dual") ? "כפול" : "מפה";
}

function spInitModeToggle() {
  const { modeToggle, close } = spEls();
  if (modeToggle) {
    modeToggle.addEventListener("click", () => {
      const mode = (document.body.dataset.mode === "dual") ? "map" : "dual";
      spSetMode(mode);
      if (mode === "dual") spEnsureStarted();
    });
  }
  if (close) {
    close.addEventListener("click", () => spSetMode("map"));
  }

  let saved = "map";
  try { saved = localStorage.getItem("kavnav_ui_mode") || "map"; } catch (_) {}
  spSetMode(saved);
}

function spBuildUrl(url) {
  // reuse existing proxy logic from the map app's fetchJson (local mode)
  return url;
}

function spCacheIsFresh(entry, ttlMs) {
  if (!entry) return false;
  return (Date.now() - entry.ts) < ttlMs;
}

async function spFetchJSON(url) {
  // use existing fetchJson from the map app (already handles local/proxy)
  return await fetchJson(spBuildUrl(url));
}

async function spGetStopSummary(stopCode) {
  const key = String(stopCode);
  const entry = SP.summaryCache.get(key);
  const TTL = 60 * 60 * 1000; // שעה
  if (spCacheIsFresh(entry, TTL)) return entry.data;

  const data = await spFetchJSON(`${API_BASE}/stopSummary?stopCode=${stopCode}`);
  if (data == null && entry) return entry.data;

  if (data) SP.summaryCache.set(key, { ts: Date.now(), data });
  return data || (entry ? entry.data : null);
}

async function spGetStopSchedule(stopCode, dateStr) {
  const key = `${String(stopCode)}|${String(dateStr)}`;
  const entry = SP.scheduleCache.get(key);
  const TTL = 2 * 60 * 1000; // 2 דקות
  if (spCacheIsFresh(entry, TTL)) return entry.data;

  const data = await spFetchJSON(`${API_BASE}/stopSchedule?stopCode=${stopCode}&date=${dateStr}`);
  if (data == null && entry) return entry.data;

  if (data) SP.scheduleCache.set(key, { ts: Date.now(), data });
  return data || (entry ? entry.data : null);
}

function spFormatDate(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date - offset).toISOString().slice(0, 10);
}

function spGetMinutesDiff(targetDate) {
  return Math.round((targetDate - new Date()) / 60000);
}

function spParseTimeStr(timeStr, dateRef) {
  const [h, m, s] = String(timeStr || "0:0:0").split(":").map(Number);
  const d = new Date(dateRef);
  d.setHours(h || 0, m || 0, s || 0, 0);
  return d;
}

async function spFindNearbyStops(lat, lon, limit = SP.maxStops, radius = SP.radius) {
  const query = `[out:json][timeout:25];(node[highway=bus_stop](around:${radius},${lat},${lon});node[public_transport=platform](around:${radius},${lat},${lon}););out body;`;
  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  const data = await spFetchJSON(url);
  if (!data || !data.elements) return [];

  const seen = new Set();
  const stops = data.elements
    .filter(el => el && el.tags && el.tags.ref)
    .map(el => ({
      name: (el.tags.name || el.tags["name:he"] || "תחנה"),
      stopCode: String(el.tags.ref),
      distance: Math.round(getDistanceBetween(lat, lon, el.lat, el.lon))
    }))
    .filter(s => {
      if (seen.has(s.stopCode)) return false;
      seen.add(s.stopCode);
      return true;
    })
    .sort((a,b) => a.distance - b.distance)
    .slice(0, limit);

  return stops;
}

function getDistanceBetween(lat1, lon1, lat2, lon2) {
  // reuse same haversine formula
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function spGetStopData(stopCode) {
  const today = new Date();
  const todayStr = spFormatDate(today);

  let [summary, schedule, realtime] = await Promise.all([
    spGetStopSummary(stopCode),
    spGetStopSchedule(stopCode, todayStr),
    spFetchJSON(`${API_BASE}/realtime?stopCode=${stopCode}`)
  ]);

  let isRealtimeStale = false;
  if (realtime) {
    SP.realtimeCache.set(String(stopCode), realtime);
  } else {
    const cached = SP.realtimeCache.get(String(stopCode));
    if (cached) {
      realtime = cached;
      isRealtimeStale = true;
    }
  }

  let fetchedName = null;
  if (Array.isArray(summary) && summary.length > 0) fetchedName = summary[0].name;
  else if (summary && summary.name) fetchedName = summary.name;

  const routeMap = {};
  (Array.isArray(summary) ? summary : [summary]).forEach(g => {
    (g && g.routes ? g.routes : []).forEach(r => routeMap[r.routeId] = r.routeNumber);
  });

  const trips = [];
  const realtimeTrips = new Set();

  if (realtime && Array.isArray(realtime.vehicles)) {
    realtime.vehicles.forEach(bus => {
      const call = bus?.trip?.onwardCalls?.calls?.find(c => String(c.stopCode) === String(stopCode));
      if (!call) return;

      const eta = new Date(call.eta);
      const minutes = spGetMinutesDiff(eta);

      // בזמן אמת: אל תציג "כעת" על מינוס (רק >=0)
      if (minutes < 0 || minutes > SP.lookaheadMin) return;

      const tripId = bus.trip?.gtfsInfo?.tripId;
      if (tripId) realtimeTrips.add(tripId);

      trips.push({
        line: bus.trip?.gtfsInfo?.routeNumber || routeMap[bus.trip?.routeId] || "?",
        headsign: bus.trip?.gtfsInfo?.headsign || "",
        minutes,
        realtime: true,
        stale: isRealtimeStale
      });
    });
  }

  if (schedule && schedule.stopSchedule) {
    const list = Array.isArray(schedule.stopSchedule) ? schedule.stopSchedule : [schedule.stopSchedule];
    list.forEach(s => {
      (s && s.trips ? s.trips : []).forEach(t => {
        if (realtimeTrips.has(t.tripId)) return;

        const dep = spParseTimeStr(t.departureTime, today);
        const minutes = spGetMinutesDiff(dep);

        if (minutes < 0 || minutes > SP.lookaheadMin) return;

        trips.push({
          line: routeMap[t.routeId] || t.routeId,
          headsign: t.headsign || "",
          minutes,
          realtime: false
        });
      });
    });
  }

  const grouped = {};
  trips.forEach(t => {
    const k = t.line + "||" + t.headsign;
    grouped[k] ??= { line: t.line, headsign: t.headsign, arrivals: [] };
    grouped[k].arrivals.push(t);
  });

  return {
    stopCode,
    name: fetchedName,
    groups: Object.values(grouped).map(g => ({
      line: g.line,
      headsign: g.headsign,
      arrivals: g.arrivals.sort((a,b) => a.minutes - b.minutes).slice(0, 4)
    }))
  };
}

function spFormatArrival(minutes) {
  if (minutes < 0) return ""; // לא אמור להגיע לכאן
  if (minutes === 0) return "כעת";
  if (minutes < 60) return minutes + " דק׳";
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function spRenderStopsStrip() {
  const { strip } = spEls();
  if (!strip) return;

  strip.innerHTML = "";

  SP.stops.forEach(s => {
    const b = document.createElement("button");
    b.className = "sp-stop-btn";
    b.dataset.code = s.stopCode;

    const name = s.name || "תחנה";
    b.innerHTML = `
      <div class="sp-stop-name">${escapeHtml(name)}</div>
      <div class="sp-stop-code">${escapeHtml(s.stopCode)}</div>
    `;

    b.addEventListener("click", () => spSelectStop(s.stopCode));
    strip.appendChild(b);
  });
}

function spSetActiveBtn(code) {
  document.querySelectorAll(".sp-stop-btn").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`.sp-stop-btn[data-code="${CSS.escape(String(code))}"]`);
  if (btn) {
    btn.classList.add("active");
    btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

function spShowLoader(msg) {
  const { loader, view, msg: msgEl } = spEls();
  if (msgEl && msg) msgEl.textContent = msg;
  if (loader) loader.style.display = "flex";
  if (view) view.style.display = "none";
}

function spShowView() {
  const { loader, view } = spEls();
  if (loader) loader.style.display = "none";
  if (view) view.style.display = "block";
}

function spRenderData(data) {
  const { title, cards, empty } = spEls();
  if (!cards || !title || !empty) return;

  title.textContent = data?.name ? data.name : ("תחנה " + (data?.stopCode || ""));

  const groups = data?.groups || [];
  cards.innerHTML = "";

  if (!groups.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  groups.forEach(g => {
    const card = document.createElement("div");
    card.className = "sp-card";

    const headsign = g.headsign || "";
    card.innerHTML = `
      <div class="sp-card-header">
        <div class="sp-route">${escapeHtml(g.line)}</div>
        <div class="sp-headsign">${escapeHtml(headsign)}</div>
      </div>
      <div class="sp-times"></div>
    `;

    const times = card.querySelector(".sp-times");
    (g.arrivals || []).slice(0, 4).forEach(a => {
      if (a.minutes < 0) return;

      const chip = document.createElement("div");
      chip.className = "sp-chip";
      const isRt = !!a.realtime;
      const isStale = !!a.stale;

      if (isRt && isStale) chip.classList.add("stale");
      else if (isRt) chip.classList.add("rt");

      const dot = (isRt) ? `<span class="sp-dot"></span>` : "";
      const val = spFormatArrival(a.minutes);

      chip.innerHTML = `${dot}<span>${escapeHtml(val)}</span>`;
      times.appendChild(chip);
    });

    cards.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function spSelectStop(code) {
  SP.activeStop = String(code);
  spSetActiveBtn(code);

  const cached = SP.dataByStop[SP.activeStop];
  if (cached) {
    spShowView();
    spRenderData(cached);
  } else {
    spShowLoader("טוען נתוני תחנה…");
  }

  // fetch immediately
  try {
    const data = await spGetStopData(SP.activeStop);
    SP.dataByStop[SP.activeStop] = data;
    spShowView();
    spRenderData(data);

    // update button name if server returned something better
    if (data?.name) {
      const stop = SP.stops.find(s => String(s.stopCode) === String(code));
      if (stop) stop.name = data.name;
      const btnName = document.querySelector(`.sp-stop-btn[data-code="${CSS.escape(String(code))}"] .sp-stop-name`);
      if (btnName && btnName.textContent !== data.name) btnName.textContent = data.name;
    }
  } catch (e) {
    console.error("spSelectStop error:", e);
  }
}

async function spReloadStops() {
  spShowLoader("מאתר תחנות קרובות…");

  // 1) location: reuse existing getUserLocation from map app
  let loc = null;
  try {
    loc = await getUserLocation();
  } catch (_) {}

  if (!loc || loc.lat == null || loc.lon == null) {
    spShowLoader("שגיאה בקבלת מיקום");
    return;
  }

  SP.currentLoc = loc;

  // 2) overpass nearby
  const stops = await spFindNearbyStops(loc.lat, loc.lon, SP.maxStops, SP.radius);

  if (!stops.length) {
    spShowLoader("לא נמצאו תחנות בסביבה");
    return;
  }

  SP.stops = stops;
  SP.dataByStop = {};
  SP.activeStop = stops[0].stopCode;

  spRenderStopsStrip();
  spSetActiveBtn(SP.activeStop);
  spShowLoader("טוען נתוני תחנה…");

  // load active stop immediately
  await spSelectStop(SP.activeStop);

  // start loop
  spStartLoop();
}

function spStartLoop() {
  if (SP.loopRunning) return;
  SP.loopRunning = true;

  const tick = async () => {
    if (!SP.loopRunning) return;

    await new Promise(r => setTimeout(r, SP.refreshMs));

    // stop if user left dual mode
    if (document.body.dataset.mode !== "dual") {
      SP.loopRunning = false;
      return;
    }

    if (SP.activeStop) {
      try {
        const data = await spGetStopData(SP.activeStop);
        SP.dataByStop[SP.activeStop] = data;
        spRenderData(data);
      } catch (e) {
        console.log("sp loop error:", e);
      }
    }

    tick();
  };

  tick();
}

function spEnsureStarted() {
  const { refresh } = spEls();
  if (refresh && !refresh.dataset.bound) {
    refresh.dataset.bound = "1";
    refresh.addEventListener("click", () => spReloadStops());
  }

  // if we already have stops - just ensure loop
  if (SP.stops.length) {
    spStartLoop();
    return;
  }
  spReloadStops();
}

/* Hook into page init */
(function spInit() {
  spInitModeToggle();

  // when user enters dual, start. when default is dual, start now.
  if (document.body.dataset.mode === "dual") spEnsureStarted();
})();