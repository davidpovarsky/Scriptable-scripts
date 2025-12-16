// KavNav - Browser App Logic

let STOPS = [];
let DATA = {};
let currentStopCode = null;

function notify(cmd) { 
  if (typeof window.handleCommand === 'function') {
    // Browser mode
    window.handleCommand(cmd);
  } else {
    // Scriptable mode
    window.location = "kavnav://" + cmd;
  }
}

function triggerRefresh() { notify("refreshLocation"); }
function triggerLoadMore() { notify("loadMore"); }

function ensureStructure() {
    const content = document.getElementById("content");
    if (!content.querySelector(".stop-container")) {
        content.innerHTML = `
            <div id="loader-msg"><div class="spinner"></div><div id="msg-text">טוען נתונים...</div></div>
            <div class="stop-container" style="display:none">
                <h2 id="stop-title"></h2>
                <div id="cards-container"></div>
                <div id="empty-msg">אין נסיעות קרובות</div>
            </div>
        `;
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
    btn.innerHTML = `<span class="btn-name">${s.name}</span><span class="btn-code">${s.stopCode}</span>`;
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
    const btn = document.querySelector(`button[data-code="${code}"] .btn-name`);
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
  
  notify("setActiveStop/" + code);

  const stopInfo = STOPS.find(s => s.stopCode === currentStopCode);
  
  document.querySelectorAll(".station-btn").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`button[data-code="${code}"]`);
  if (btn) {
    btn.classList.add("active");
    btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  const loader = document.getElementById("loader-msg");
  if(loader) loader.style.display = "none";
  const container = document.querySelector(".stop-container");
  if(container) container.style.display = "block";

  document.getElementById("stop-title").textContent = stopInfo ? stopInfo.name : "תחנה";

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
    
    let html = `
      <div class="line-header">
        <div class="route-num">${g.line}</div>
        <div class="headsign">${g.headsign}</div>
      </div>
      <div class="times-row">`;
    
    for(let i=0; i<4; i++) {
        html += `<div class="time-chip" data-idx="${i}" style="display:none">
            <div class="pulse-dot"></div>
            <span class="t-val"></span>
        </div>`;
    }
    html += `</div>`;
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
        let card = cardsContainer.querySelector(`.line-card[data-key="${key}"]`);

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
