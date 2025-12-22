// modules/stops/kavnavStopsPanel.js
// Stops panel UI (מבוסס על "תחנות קרובות זמן אמת" - web/app.js)
// מותאם לפרויקט המשולב: scoped ל-pane-nearby ומוזן מה-payload של updateRealtimeData.

(function () {
  const state = {
    stops: [],
    data: {}, // stopCode -> { groups: [...] }
    currentStopCode: null,
    lastSearchResults: [],
    initialized: false,
    offline: false,
  };

  function pane() {
    return document.querySelector(".pane-nearby") || document.body;
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function safeText(v) {
    return (v == null) ? "" : String(v);
  }

  function ensureStructure() {
    // view.js כבר בונה את המבנה; זה רק safety-net
    const root = byId("stopsPanelRoot");
    if (!root) return;

    if (!byId("content")) {
      const c = document.createElement("div");
      c.id = "content";
      root.appendChild(c);
    }

    if (!byId("scroll-area")) {
      const h = document.createElement("header");
      h.className = "kavnav-stops-header";
      const btn = document.createElement("button");
      btn.id = "refresh-btn";
      btn.type = "button";
      btn.textContent = "⟳";
      const sa = document.createElement("div");
      sa.id = "scroll-area";
      sa.className = "scroll-area";
      h.appendChild(btn);
      h.appendChild(sa);
      root.insertBefore(h, byId("content"));
    }

    // Loader message (אם אין עדיין)
    const content = byId("content");
    if (content && !content.querySelector(".loader-msg")) {
      const msg = document.createElement("div");
      msg.className = "loader-msg";
      msg.textContent = "טוען תחנות…";
      content.appendChild(msg);
    }
  }

  function updateConnectionStatus() {
    // בפרויקט המשולב אנחנו לא “יודעים” באמת online/offline בצורה מלאה,
    // אבל נשמור את זה כדי לא לשבור UI.
    const el = byId("connection-status");
    if (!el) return;

    const online = navigator.onLine;
    if (online && state.offline) {
      state.offline = false;
      el.classList.add("hidden");
    } else if (!online) {
      state.offline = true;
      el.textContent = "אין חיבור";
      el.classList.remove("hidden");
    }
  }

  function showToast(message) {
    const root = byId("stopsPanelRoot");
    if (!root) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    root.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 250);
    }, 1800);
  }

  function createStopButton(stop) {
    const btn = document.createElement("button");
    btn.className = "stop-btn";
    btn.dataset.stopCode = safeText(stop.stopCode);

    const name = document.createElement("span");
    name.className = "stop-name";
    name.textContent = safeText(stop.name || stop.stopName || stop.title || stop.stop_code || stop.stopCode);

    const code = document.createElement("span");
    code.className = "stop-code";
    code.textContent = safeText(stop.stopCode);

    btn.appendChild(name);
    btn.appendChild(code);

    btn.addEventListener("click", () => {
      selectStop(btn.dataset.stopCode);
    });

    return btn;
  }

  function renderStopButtons() {
    const scrollArea = byId("scroll-area");
    if (!scrollArea) return;

    scrollArea.innerHTML = "";
    state.stops.forEach((stop) => {
      scrollArea.appendChild(createStopButton(stop));
    });
  }

  function selectStop(stopCode) {
    const code = safeText(stopCode);
    if (!code) return;

    state.currentStopCode = code;

    // UI highlight
    const activeBtn = document.querySelector(`.stop-btn[data-stop-code="${CSS.escape(code)}"]`);
    document.querySelectorAll(".stop-btn.active").forEach((b) => b.classList.remove("active"));
    if (activeBtn) activeBtn.classList.add("active");

    syncUI();
  }

  function updateStopName(stopCode, newName) {
    const code = safeText(stopCode);
    const btn = document.querySelector(`.stop-btn[data-stop-code="${CSS.escape(code)}"]`);
    if (!btn) return;
    const nameEl = btn.querySelector(".stop-name");
    if (nameEl) nameEl.textContent = safeText(newName);
  }

  function updateData(stopCode, data) {
    const code = safeText(stopCode);
    state.data[code] = data || { groups: [] };
    if (state.currentStopCode === code) syncUI();
  }

  function getStopData() {
    const code = state.currentStopCode;
    if (!code) return null;
    return state.data[code] || { groups: [] };
  }

  function formatArrival(minutes) {
    if (minutes === 0) return "כעת";
    if (minutes < 60) return `${minutes} דק׳`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, "0")}`;
  }

  function createLineCard(group) {
    const card = document.createElement("div");
    card.className = "line-card";

    const header = document.createElement("div");
    header.className = "line-header";

    const lineBox = document.createElement("div");
    lineBox.className = "line-num";
    lineBox.textContent = safeText(group.line || "");

    const headsign = document.createElement("div");
    headsign.className = "line-dest";
    headsign.textContent = safeText(group.headsign || "");

    header.appendChild(lineBox);
    header.appendChild(headsign);

    const times = document.createElement("div");
    times.className = "line-times";

    const arrivals = Array.isArray(group.arrivals) ? group.arrivals : [];
    arrivals.forEach((a) => {
      const chip = document.createElement("span");
      chip.className = "time-chip";
      chip.textContent = formatArrival(a.minutes);
      times.appendChild(chip);
    });

    card.appendChild(header);
    card.appendChild(times);

    return card;
  }

  function syncUI() {
    const content = byId("content");
    if (!content) return;

    const currentStop = state.stops.find(s => safeText(s.stopCode) === safeText(state.currentStopCode));
    const stopName = safeText(currentStop?.name || currentStop?.stopName || "");
    const stopCode = safeText(state.currentStopCode || "");

    const data = getStopData();
    const groups = Array.isArray(data?.groups) ? data.groups : [];

    content.innerHTML = "";

    const title = document.createElement("div");
    title.className = "stop-title";
    title.innerHTML = `<div class="stop-title-name">${stopName || "תחנה"}</div><div class="stop-title-code">${stopCode}</div>`;
    content.appendChild(title);

    if (!groups.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "אין נתוני זמן אמת לתחנה הזו כרגע…";
      content.appendChild(empty);
      return;
    }

    groups.forEach((g) => {
      // רק אם יש לפחות זמן אחד להצגה
      if (Array.isArray(g.arrivals) && g.arrivals.length) {
        content.appendChild(createLineCard(g));
      }
    });
  }

  function normalizeStops(inStops) {
    return (Array.isArray(inStops) ? inStops : []).map(s => ({
      stopCode: safeText(s.stopCode || s.code || s.stop_code),
      name: safeText(s.name || s.stopName || s.title || s.stop_name),
      raw: s
    })).filter(s => s.stopCode);
  }

  function addStops(stops) {
    ensureStructure();

    state.stops = normalizeStops(stops);
    state.data = {};
    state.lastSearchResults = [];

    renderStopButtons();

    const content = byId("content");
    if (content) {
      content.innerHTML = `<div class="loader-msg">בחר תחנה מהרשימה למעלה</div>`;
    }

    if (state.stops.length) {
      selectStop(state.stops[0].stopCode);
    }
  }

  // ===== חיפוש מקומי: רק בתוך התחנות הקרובות =====
  function showSearch() {
    const overlay = byId("search-overlay");
    const container = byId("search-container");
    if (overlay) overlay.classList.add("active");
    if (container) container.classList.add("active");
    const input = byId("search-input");
    if (input) {
      input.value = "";
      input.focus();
    }
    clearSearchResults();
  }

  function hideSearch() {
    const overlay = byId("search-overlay");
    const container = byId("search-container");
    if (overlay) overlay.classList.remove("active");
    if (container) container.classList.remove("active");
    clearSearchResults();
  }

  function clearSearchResults() {
    const results = byId("search-results");
    if (results) results.innerHTML = "";
    state.lastSearchResults = [];
  }

  function displaySearchResults(results) {
    const container = byId("search-results");
    if (!container) return;
    container.innerHTML = "";

    if (!results.length) {
      container.innerHTML = '<div class="no-results">לא נמצאו תחנות תואמות</div>';
      return;
    }

    results.forEach(stop => {
      const item = document.createElement("div");
      item.className = "search-result";

      const name = document.createElement("div");
      name.className = "result-name";
      name.textContent = safeText(stop.name);

      const code = document.createElement("div");
      code.className = "result-code";
      code.textContent = safeText(stop.stopCode);

      item.appendChild(name);
      item.appendChild(code);

      item.addEventListener("click", () => {
        hideSearch();
        selectStop(stop.stopCode);
      });

      container.appendChild(item);
    });
  }

  function performSearch(query) {
    const q = safeText(query).trim();
    if (!q) {
      clearSearchResults();
      return;
    }

    const qLower = q.toLowerCase();
    const results = state.stops.filter(s => {
      const code = safeText(s.stopCode);
      const name = safeText(s.name);
      return code.includes(q) || name.toLowerCase().includes(qLower);
    });

    state.lastSearchResults = results;
    displaySearchResults(results);
  }

  function initSearchHandlers() {
    // click handlers
    const overlay = byId("search-overlay");
    if (overlay) overlay.addEventListener("click", hideSearch);

    const btn = byId("search-btn");
    if (btn) btn.addEventListener("click", () => showSearch());

    const input = byId("search-input");
    if (input) {
      input.addEventListener("input", () => performSearch(input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hideSearch();
      });
    }

    const refresh = byId("refresh-btn");
    if (refresh) {
      refresh.addEventListener("click", () => {
        showToast("הנתונים מתעדכנים אוטומטית");
        syncUI();
      });
    }

    // swipe-down רק בתוך pane-nearby (לא על כל המסך!)
    const p = pane();
    let startY = 0;

    p.addEventListener("touchstart", (e) => {
      startY = e.touches?.[0]?.clientY || 0;
    }, { passive: true });

    p.addEventListener("touchend", (e) => {
      const endY = e.changedTouches?.[0]?.clientY || 0;
      const diff = endY - startY;
      if (diff > 60) {
        showSearch();
      }
    }, { passive: true });
  }

  // ===== מתרגם את ה-payload הקיים (updates) ל-data של הכרטיסים =====
  function updateFromRealtimePayload(updates) {
    if (!Array.isArray(updates) || !state.stops.length) return;

    const stopSet = new Set(state.stops.map(s => safeText(s.stopCode)));
    const now = Date.now();

    // stopCode -> key -> group
    const perStop = new Map();

    for (const u of updates) {
      const vehicles = Array.isArray(u.vehicles) ? u.vehicles : [];
      for (const v of vehicles) {
        const line = safeText(v.routeNumber || v.trip?.routeNumber || v.trip?.routeShortName || v.trip?.routeId || u.routeId || "");
        const headsign = safeText(v.headsign || v.trip?.headsign || "");
        const calls = Array.isArray(v.onwardCalls) ? v.onwardCalls : [];

        for (const c of calls) {
          const stopCode = safeText(c.stopCode);
          if (!stopSet.has(stopCode)) continue;

          const etaRaw = c.eta;
          const etaMs = (typeof etaRaw === "number") ? etaRaw : Date.parse(etaRaw);
          if (!etaMs || Number.isNaN(etaMs)) continue;

          const minutes = Math.floor((etaMs - now) / 60000);

          // חשוב: לא מציגים מינוס כ"כעת"
          if (minutes < 0) continue;

          const key = `${line}||${headsign}`;

          if (!perStop.has(stopCode)) perStop.set(stopCode, new Map());
          const m = perStop.get(stopCode);

          if (!m.has(key)) {
            m.set(key, { line, headsign, arrivals: [] });
          }

          m.get(key).arrivals.push({ minutes, realtime: true, stale: false });
        }
      }
    }

    // כתיבה ל-state.data
    for (const s of state.stops) {
      const sc = safeText(s.stopCode);
      const groupsMap = perStop.get(sc);

      let groups = [];
      if (groupsMap) {
        groups = Array.from(groupsMap.values()).map(g => {
          g.arrivals.sort((a, b) => a.minutes - b.minutes);
          g.arrivals = g.arrivals.slice(0, 4);
          return g;
        });

        // מיון כללי (לפי מספר קו אם אפשר)
        groups.sort((a, b) => {
          const na = parseInt(a.line, 10);
          const nb = parseInt(b.line, 10);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
          return safeText(a.line).localeCompare(safeText(b.line), "he");
        });
      }

      updateData(sc, { groups });
    }
  }

  function ensureReady() {
    if (state.initialized) return;
    state.initialized = true;

    ensureStructure();
    initSearchHandlers();
    updateConnectionStatus();

    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);

    // status tick
    setInterval(updateConnectionStatus, 5000);
  }

  // חשיפה ל-web/app.js
  window.KavNavStopsPanel = {
    ensureReady,
    addStops,
    updateStopName,
    updateData,
    updateFromRealtimePayload,
    selectStop
  };

  // אתחול מיידי (DOM כבר נטען אצלך דרך initApp)
  try { ensureReady(); } catch (e) { console.warn("StopsPanel init warning:", e); }
})();
