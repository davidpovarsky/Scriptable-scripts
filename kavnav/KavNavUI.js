{
type: uploaded file
fileName: KavNavUI.js
fullContent:
// KavNavUI.js

module.exports.buildHTML = function() {
  return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"/>
<style>
:root { --bg:#0b0f14; --card:#1f2937; --text:#e5e7eb; --accent:#2563eb; --realtime:#22c55e; --stale:#f97316; }
body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system, sans-serif; padding-bottom:20px; }

header { display:flex; align-items:center; background:#111827; position:sticky; top:0; z-index:100; box-shadow:0 4px 6px -1px rgba(0,0,0,0.3); height:60px; }
#refresh-btn { flex-shrink:0; width:50px; height:100%; background:transparent; border:none; display:flex; align-items:center; justify-content:center; border-left:1px solid #374151; cursor:pointer; }
#refresh-btn svg { width:20px; height:20px; fill:#9ca3af; }
#refresh-btn:active svg { fill:var(--accent); transform:rotate(45deg); transition:0.2s; }

#scroll-area { flex-grow:1; display:flex; gap:8px; overflow-x:auto; padding:0 12px; align-items:center; height:100%; scrollbar-width:none; }
#scroll-area::-webkit-scrollbar { display:none; }

.station-btn { background:var(--card); color:#9ca3af; border:none; border-radius:12px; padding:6px 12px; min-width:60px; display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.2s; }
.station-btn.active { background:var(--accent); color:#fff; box-shadow:0 0 10px rgba(37,99,235,0.4); }
.btn-name { font-size:13px; white-space:nowrap; max-width:120px; overflow:hidden; text-overflow:ellipsis; }
.btn-code { font-size:10px; opacity:0.8; }

#load-more-btn { background:rgba(255,255,255,0.1); color:#fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; flex-shrink:0; border:none; margin-right:5px; }

.stop-container { padding:16px; }
h2 { margin:0 0 16px 0; font-size:18px; color:#9ca3af; font-weight:normal; }

.line-card { background:var(--card); margin-bottom:12px; padding:12px 16px; border-radius:12px; transition: transform 0.2s; }
.line-header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; }
.route-num { font-size:22px; font-weight:800; color:#fff; }
.headsign { font-size:14px; color:#9ca3af; max-width:70%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.times-row { display:flex; gap:10px; overflow-x:auto; min-height: 34px; }
.time-chip { background:rgba(255,255,255,0.05); padding:4px 10px; border-radius:8px; font-size:14px; display:flex; align-items:center; gap:4px; white-space:nowrap; transition: background 0.3s; }

.time-chip.realtime { background:rgba(34,197,94,0.15); color:var(--realtime); border:1px solid rgba(34,197,94,0.3); }
.time-chip.stale { background:rgba(249,115,22,0.15) !important; color:var(--stale) !important; border:1px solid rgba(249,115,22,0.3) !important; }

.pulse-dot { width:6px; height:6px; background:currentColor; border-radius:50%; animation:pulse 1.5s infinite; }

#loader-msg { height:60vh; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#6b7280; gap:15px; }
.spinner { width:30px; height:30px; border:3px solid rgba(255,255,255,0.1); border-left-color:var(--accent); border-radius:50%; animation:spin 1s linear infinite; }
@keyframes spin { 100% { transform:rotate(360deg); } }
@keyframes pulse { 0% { opacity:0.4; } 50% { opacity:1; } 100% { opacity:0.4; } }

#empty-msg { text-align:center; opacity:0.6; margin-top:20px; display:none; }
</style>
</head>
<body>

<header>
  <button id="refresh-btn" onclick="triggerRefresh()">
    <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </button>
  <div id="scroll-area"></div>
</header>

<div id="content">
  </div>

<script>
let STOPS = [];
let DATA = {};
let currentStopCode = null;

function notify(cmd) { window.location = "kavnav://" + cmd; }
function triggerRefresh() { notify("refreshLocation"); }
function triggerLoadMore() { notify("loadMore"); }

/* ===== INITIAL SETUP ===== */

function ensureStructure() {
    const content = document.getElementById("content");
    if (!content.querySelector(".stop-container")) {
        content.innerHTML = \`
            <div id="loader-msg"><div class="spinner"></div><div id="msg-text">טוען נתונים...</div></div>
            <div class="stop-container" style="display:none">
                <h2 id="stop-title"></h2>
                <div id="cards-container"></div>
                <div id="empty-msg">אין נסיעות קרובות</div>
            </div>
        \`;
    }
}

window.resetUI = function(msg) {
  STOPS = []; DATA = {}; currentStopCode = null;
  document.getElementById("scroll-area").innerHTML = "";
  const loader = document.getElementById("loader-msg");
  if(loader) {
      loader.style.display = "flex";
      document.getElementById("msg-text").textContent = msg || 'טוען...';
      document.querySelector(".stop-container").style.display = "none";
  } else {
      ensureStructure(); 
  }
};

window.addStops = function(newStops, selectFirst = false) {
  ensureStructure();
  const scrollArea = document.getElementById("scroll-area");
  const existingPlus = document.getElementById("load-more-btn");
  if(existingPlus) existingPlus.remove();

  newStops.forEach(s => {
    if (STOPS.find(x => x.stopCode === s.stopCode)) return;
    STOPS.push(s);
    const btn = document.createElement("button");
    btn.className = "station-btn";
    btn.dataset.code = s.stopCode;
    btn.innerHTML = \`<span class="btn-name">\${s.name}</span><span class="btn-code">\${s.stopCode}</span>\`;
    btn.onclick = () => selectStop(s.stopCode);
    scrollArea.appendChild(btn);
  });

  const plusBtn = document.createElement("button");
  plusBtn.id = "load-more-btn";
  plusBtn.innerHTML = "+";
  plusBtn.onclick = triggerLoadMore;
  scrollArea.appendChild(plusBtn);

  if (selectFirst && STOPS.length > 0) selectStop(STOPS[0].stopCode);
};

window.updateStopName = function(code, name) {
  const s = STOPS.find(x => x.stopCode === String(code));
  if (s) {
    s.name = name;
    const btn = document.querySelector(\`button[data-code="\${code}"] .btn-name\`);
    if (btn) btn.textContent = name;
    if (currentStopCode === String(code)) {
       document.getElementById("stop-title").textContent = name;
    }
  }
}

window.updateData = function(stopCode, data) {
  DATA[stopCode] = data;
  if (currentStopCode === String(stopCode)) {
    syncUI(data);
  }
};

function selectStop(code) {
  currentStopCode = String(code);
  
  // ✅ שליחת עדכון לסקריפט הראשי איזו תחנה נבחרה
  notify("setActiveStop/" + code);

  const stopInfo = STOPS.find(s => s.stopCode === currentStopCode);
  
  // Update Buttons
  document.querySelectorAll(".station-btn").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(\`button[data-code="\${code}"]\`);
  if (btn) {
    btn.classList.add("active");
    btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  // Hide Loader, Show Container
  const loader = document.getElementById("loader-msg");
  if(loader) loader.style.display = "none";
  const container = document.querySelector(".stop-container");
  if(container) container.style.display = "block";

  // Set Title
  document.getElementById("stop-title").textContent = stopInfo ? stopInfo.name : "תחנה";

  // Force Render
  const data = DATA[currentStopCode];
  syncUI(data);
}

function generateGroupKey(g) { return g.line + "||" + g.headsign; }

function formatArrival(minutes){
  if (minutes <= 0) return "כעת";
  if (minutes < 60) return minutes + " דק׳";
  const d = new Date(); d.setMinutes(d.getMinutes() + minutes);
  return d.toLocaleTimeString("he-IL", {hour:"2-digit", minute:"2-digit"});
}

function createLineCard(g) {
    const card = document.createElement("div");
    card.className = "line-card";
    card.dataset.key = generateGroupKey(g);
    
    let html = \`
      <div class="line-header">
        <div class="route-num">\${g.line}</div>
        <div class="headsign">\${g.headsign}</div>
      </div>
      <div class="times-row">\`;
    
    for(let i=0; i<4; i++) {
        html += \`<div class="time-chip" data-idx="\${i}" style="display:none">
            <div class="pulse-dot"></div>
            <span class="t-val"></span>
        </div>\`;
    }
    html += \`</div>\`;
    card.innerHTML = html;
    updateCardTimes(card, g.arrivals);
    return card;
}

function updateCardTimes(card, arrivals) {
    const chips = card.querySelectorAll(".time-chip");
    chips.forEach((chip, i) => {
        const a = arrivals[i];
        if (!a) {
            if (chip.style.display !== "none") chip.style.display = "none";
        } else {
            if (chip.style.display !== "flex") chip.style.display = "flex";
            
            const isRt = !!a.realtime;
            const isStale = !!a.stale;

            chip.classList.toggle("realtime", isRt && !isStale);
            chip.classList.toggle("stale", isRt && isStale);
            
            const dot = chip.querySelector(".pulse-dot");
            const dotDisplay = isRt ? "block" : "none";
            if (dot.style.display !== dotDisplay) dot.style.display = dotDisplay;

            const valSpan = chip.querySelector(".t-val");
            const newText = formatArrival(a.minutes);
            if (valSpan.textContent !== newText) valSpan.textContent = newText;
        }
    });
}

function syncUI(data) {
    const cardsContainer = document.getElementById("cards-container");
    const emptyMsg = document.getElementById("empty-msg");
    
    if (!data || !data.groups || data.groups.length === 0) {
        cardsContainer.innerHTML = "";
        emptyMsg.style.display = "block";
        return;
    }
    
    emptyMsg.style.display = "none";
    const groups = data.groups;
    
    const currentCards = Array.from(cardsContainer.children);
    const newKeys = new Set(groups.map(generateGroupKey));

    currentCards.forEach(card => {
        if (!newKeys.has(card.dataset.key)) {
            card.remove();
        }
    });

    groups.forEach(g => {
        const key = generateGroupKey(g);
        let card = cardsContainer.querySelector(\`.line-card[data-key="\${key}"]\`);

        if (card) {
            updateCardTimes(card, g.arrivals);
            cardsContainer.appendChild(card);
        } else {
            card = createLineCard(g);
            cardsContainer.appendChild(card);
        }
    });
}

ensureStructure();

</script>
</body>
</html>`;
};
}
