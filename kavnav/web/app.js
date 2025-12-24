// KavNav - Browser App Logic

let STOPS = [];
let DATA = {};
let currentStopCode = null;
let searchTimeout = null;

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

// ========== חיפוש ==========
let touchStartY = 0;
let touchEndY = 0;

function initSearch() {
  const searchOverlay = document.getElementById('search-overlay');
  const searchContainer = document.getElementById('search-container');
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  
  // זיהוי תנועת גלילה כלפי מעלה
  document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  });

  document.addEventListener('touchend', (e) => {
    touchEndY = e.changedTouches[0].clientY;
    const swipeDistance = touchEndY - touchStartY;

    // אם עשו סווייפ למטה לפחות 100 פיקסלים
    if (swipeDistance > 100) {
      showSearch();
    }
  });
  
  // סגירת חיפוש בלחיצה על overlay
  searchOverlay.addEventListener('click', hideSearch);
  
  // חיפוש תוך כדי הקלדה
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length === 0) {
      searchResults.classList.remove('visible');
      return;
    }
    
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });
  
  // מניעת סגירה בלחיצה על החיפוש עצמו
  searchContainer.addEventListener('click', (e) => {
    e.stopPropagation();
  });
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
  notify("search/" + encodeURIComponent(query));
}

window.displaySearchResults = function(results) {
  const searchResults = document.getElementById('search-results');
  
  if (!results || results.length === 0) {
    searchResults.innerHTML = '<div style="padding:20px; text-align:center; color:#6b7280;">לא נמצאו תוצאות</div>';
    searchResults.classList.add('visible');
    return;
  }
  
  searchResults.innerHTML = results.map(stop => `
    <div class="search-result-item" onclick="selectSearchResult('${stop.stopCode}', ${stop.lat}, ${stop.lon})">
      <div class="search-result-name">${stop.stopName}</div>
      <div class="search-result-code">קוד: ${stop.stopCode} | מזהה: ${stop.stopId}</div>
      <div class="search-result-desc">${stop.stopDesc}</div>
    </div>
  `).join('');
  
  searchResults.classList.add('visible');
};

function selectSearchResult(stopCode, lat, lon) {
  hideSearch();
  notify("selectSearchStop/" + stopCode + "/" + lat + "/" + lon);
}

window.resetUI = function(msg) {
  STOPS = []; 
  DATA = {}; 
  currentStopCode = null;
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
  const d = new Date(); 
  d.setMinutes(d.getMinutes() + minutes);
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

    // הסרת כרטיסים שלא קיימים יותר
    currentCards.forEach(card => {
        if (!newKeys.has(card.dataset.key)) {
            card.remove();
        }
    });

    // עדכון/יצירת כרטיסים
    groups.forEach(g => {
        const key = generateGroupKey(g);
        // ✅ חזרה לגרסה המקורית - עובדת עם תווים מיוחדים!
        let card = Array.from(cardsContainer.children).find(el => el.dataset && el.dataset.key === key);

        if (card) {
            // עדכון כרטיס קיים
            updateCardTimes(card, g.arrivals);
            cardsContainer.appendChild(card); // הזזה לסוף (למיון)
        } else {
            // יצירת כרטיס חדש
            card = createLineCard(g);
            cardsContainer.appendChild(card);
        }
    });
}

ensureStructure();
initSearch();