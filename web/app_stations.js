// KavNav - Browser App Logic (Renamed for Dual Mode)

let STOPS = [];
let DATA = {};
let currentStopCode = null;
let searchTimeout = null;

// במצב כפול, notify בדרך כלל לא תעבוד דרך ה-URL הרגיל, כי main.js מנהל את הכל.
// אבל נשאיר את זה לחיפושים ידניים אם נרצה להוסיף תמיכה בעתיד.
function notify(cmd) { 
  console.log("Stations notify:", cmd);
  // כאן אפשר להוסיף window.location = ... אם רוצים תקשורת חזרה ל-Scriptable
  // עבור המצב האוטומטי, main.js דוחף נתונים לבד.
}

function triggerRefresh() { notify("refreshLocation"); }
function triggerLoadMore() { notify("loadMore"); }

function ensureStructure() {
    const content = document.getElementById("content");
    // מוודא שאנחנו לא דורסים את המפה, אלא עובדים בתוך הדיב של התחנות
    if (!content) return; 

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

// ========== חיפוש ==========
let touchStartY = 0;
let touchEndY = 0;

function initSearch() {
  const searchOverlay = document.getElementById('search-overlay');
  const searchContainer = document.getElementById('search-container');
  const searchInput = document.getElementById('search-input');
  
  if(!searchContainer) return;

  // לוגיקת סווייפ לפתיחת חיפוש בתוך הפאנל
  const panel = document.getElementById('stations-panel');
  if(panel) {
      panel.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; });
      panel.addEventListener('touchend', (e) => {
        touchEndY = e.changedTouches[0].clientY;
        if (touchEndY - touchStartY > 100) showSearch();
      });
  }
  
  if(searchOverlay) searchOverlay.addEventListener('click', hideSearch);
  
  if(searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length === 0) {
          document.getElementById('search-results').classList.remove('visible');
          return;
        }
        searchTimeout = setTimeout(() => performSearch(query), 300);
      });
  }
}

function showSearch() {
  document.getElementById('search-overlay').classList.add('visible');
  document.getElementById('search-container').classList.add('visible');
  document.getElementById('search-input').focus();
}

function hideSearch() {
  document.getElementById('search-overlay').classList.remove('visible');
  document.getElementById('search-container').classList.remove('visible');
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').classList.remove('visible');
}

async function performSearch(query) {
  // בגרסה משולבת זו, אין לנו עדיין נתיב חזרה ל-Main לחיפוש
  console.log("Search not implemented in dual mode yet: " + query);
}

// פונקציה ראשית שנקראת מ-main.js כדי להוסיף תחנות
window.addStops = function(newStops, selectFirst = false) {
  ensureStructure();
  const scrollArea = document.getElementById("scroll-area");
  if(!scrollArea) return;

  const existingPlus = document.getElementById("load-more-btn");
  if(existingPlus) existingPlus.remove();

  newStops.forEach(s => {
    if (STOPS.find(x => x.stopCode === s.stopCode)) return;
    STOPS.push(s);
    const btn = document.createElement("button");
    btn.className = "station-btn";
    btn.dataset.code = s.stopCode;
    btn.innerHTML = `<span class="btn-name">${s.stopName || s.name}</span><span class="btn-code">${s.stopCode}</span>`;
    btn.onclick = () => selectStop(s.stopCode);
    scrollArea.appendChild(btn);
  });

  // כפתור פלוס (לא פעיל כרגע במצב כפול)
  // const plusBtn = document.createElement("button"); ... scrollArea.appendChild(plusBtn);

  if (selectFirst && STOPS.length > 0 && !currentStopCode) {
      selectStop(STOPS[0].stopCode);
  }
};

window.updateData = function(stopCode, data) {
  DATA[stopCode] = data;
  if (currentStopCode === String(stopCode)) {
    syncUI(data);
  }
};

function selectStop(code) {
  currentStopCode = String(code);
  
  // עדכון כפתורים
  document.querySelectorAll(".station-btn").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`button[data-code="${code}"]`);
  if (btn) {
    btn.classList.add("active");
    btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  // הצגת תוכן
  const loader = document.getElementById("loader-msg");
  if(loader) loader.style.display = "none";
  
  const container = document.querySelector(".stop-container");
  if(container) container.style.display = "block";

  const stopInfo = STOPS.find(s => s.stopCode === currentStopCode);
  const title = document.getElementById("stop-title");
  if(title) title.textContent = stopInfo ? (stopInfo.stopName || stopInfo.name) : "תחנה";

  const data = DATA[currentStopCode];
  syncUI(data);
}

// --- פונקציות עזר ליצירת כרטיסים (זהות למקור) ---

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
    if(!cardsContainer) return;

    if (!data || !data.groups || data.groups.length === 0) {
        cardsContainer.innerHTML = "";
        if(emptyMsg) emptyMsg.style.display = "block";
        return;
    }
    
    if(emptyMsg) emptyMsg.style.display = "none";
    const groups = data.groups;
    
    const currentCards = Array.from(cardsContainer.children);
    const newKeys = new Set(groups.map(generateGroupKey));

    currentCards.forEach(card => {
        if (!newKeys.has(card.dataset.key)) card.remove();
    });

    groups.forEach(g => {
        const key = generateGroupKey(g);
        let card = cardsContainer.querySelector(`.line-card[data-key="${key}"]`);
        if (card) {
            updateCardTimes(card, g.arrivals);
            cardsContainer.appendChild(card); // Move to end/reorder logic if needed
        } else {
            card = createLineCard(g);
            cardsContainer.appendChild(card);
        }
    });
}

// אתחול
ensureStructure();
initSearch();
