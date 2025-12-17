// KavNavUI.js - בניית HTML חכם לפי סביבה

// ===============================
// זיהוי סביבה
// ===============================
var IS_SCRIPTABLE = typeof window !== 'undefined' ? window.IS_SCRIPTABLE : (typeof FileManager !== 'undefined');
var IS_BROWSER = typeof window !== 'undefined' ? window.IS_BROWSER : false;

// ===============================
// CSS - משותף לכולם (כולל תוספות לחיפוש)
// ===============================
var CSS_CONTENT = `
:root { --bg:#0b0f14; --card:#1f2937; --text:#e5e7eb; --accent:#2563eb; --realtime:#22c55e; --stale:#f97316; --input-bg: #374151; }
body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system, sans-serif; padding-bottom:20px; }

header { display:flex; flex-direction: column; align-items:center; background:#111827; position:sticky; top:0; z-index:100; box-shadow:0 4px 6px -1px rgba(0,0,0,0.3); }

/* שורת הכותרת העליונה (כפתור רענון) */
.header-top { width: 100%; height: 60px; display: flex; align-items: center; justify-content: space-between; }
#refresh-btn { flex-shrink:0; width:50px; height:100%; background:transparent; border:none; display:flex; align-items:center; justify-content:center; border-left:1px solid #374151; cursor:pointer; }
#refresh-btn svg { width:20px; height:20px; fill:#9ca3af; }

/* אזור החיפוש */
#search-container {
    width: 90%;
    max-width: 400px;
    height: 0;
    overflow: hidden;
    transition: height 0.3s ease, margin 0.3s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
}
#search-container.visible {
    height: auto;
    margin-bottom: 15px;
    padding-bottom: 5px;
}

#search-input-wrapper {
    width: 100%;
    position: relative;
    display: flex;
    justify-content: center;
}

#search-input {
    width: 100%;
    background: var(--input-bg);
    border: 1px solid #4b5563;
    color: white;
    padding: 10px 15px;
    border-radius: 20px; /* עגול בקצוות */
    font-size: 16px;
    outline: none;
    text-align: right;
}
#search-input:focus { border-color: var(--accent); }

#search-results {
    width: 100%;
    max-height: 300px;
    overflow-y: auto;
    background: var(--card);
    border-radius: 8px;
    margin-top: 5px;
    display: none;
    position: absolute;
    top: 45px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
    z-index: 200;
}

.search-item {
    padding: 12px;
    border-bottom: 1px solid #374151;
    cursor: pointer;
    text-align: right;
}
.search-item:last-child { border-bottom: none; }
.search-item:active { background: #374151; }
.s-name { font-weight: bold; font-size: 15px; color: #fff; }
.s-desc { font-size: 13px; color: #9ca3af; margin-top: 2px; }
.s-code { float: left; font-size: 12px; color: var(--accent); background: rgba(37, 99, 235, 0.1); padding: 2px 6px; border-radius: 4px; }


#content { padding: 15px; max-width: 600px; margin: 0 auto; }
.stop-container { margin-bottom: 20px; animation: fadeIn 0.5s; }
.stop-header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; border-bottom:1px solid #374151; padding-bottom:5px; }
.stop-name { font-size:18px; font-weight:700; color:#fff; }
.stop-code { font-size:14px; color:#6b7280; font-family:monospace; }

.line-card { background:var(--card); border-radius:12px; padding:12px; margin-bottom:10px; display:flex; flex-direction:column; gap:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
.line-header { display:flex; justify-content:space-between; align-items:center; }
.line-num { font-size:22px; font-weight:800; color:#fff; }
.headsign { font-size:14px; color:#9ca3af; max-width:70%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.times-row { display:flex; gap:10px; overflow-x:auto; min-height: 34px; padding-bottom: 5px; } /* גלילה רוחבית */
.time-chip { background:rgba(255,255,255,0.05); padding:4px 10px; border-radius:8px; font-size:14px; display:flex; align-items:center; gap:4px; white-space:nowrap; transition: background 0.3s; }
.time-chip.realtime { background:rgba(34,197,94,0.15); color:var(--realtime); border:1px solid rgba(34,197,94,0.3); }
.time-chip.stale { background:rgba(249,115,22,0.15) !important; color:var(--stale) !important; border:1px solid rgba(249,115,22,0.3); }
.pulse-dot { width:6px; height:6px; background:currentColor; border-radius:50%; animation:pulse 1.5s infinite; display:none; }

@keyframes pulse { 0% { opacity:1; } 50% { opacity:0.4; } 100% { opacity:1; } }
@keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

#loader-msg { display:flex; flex-direction:column; align-items:center; justify-content:center; height:200px; color:#9ca3af; gap:15px; }
.spinner { width:30px; height:30px; border:3px solid rgba(255,255,255,0.1); border-top-color:var(--accent); border-radius:50%; animation:spin 1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
`;

// ===============================
// JS - לוגיקת לקוח (דפדפן/WebView)
// ===============================
var JS_CONTENT = `
// משתנים גלובליים
let ALL_STOPS = [];
let SEARCH_TIMEOUT = null;
let LAST_SCROLL_Y = 0;
let IS_SEARCH_VISIBLE = false;

// תקשורת עם Scriptable
function notify(cmd, data) {
  const json = data ? JSON.stringify(data) : "";
  const url = "kavnav://" + cmd + "?data=" + encodeURIComponent(json);
  
  if (window.IS_SCRIPTABLE) {
     window.location.href = url;
  } else if (typeof window.handleCommand === 'function') {
     window.handleCommand(cmd, data);
  } else {
     console.log("Notify:", cmd, data);
  }
}

// פונקציות ממשק ראשיות
function triggerRefresh() { 
    // רענון חוזר למיקום האמיתי
    notify("refreshLocation"); 
    document.getElementById("search-input").value = "";
    document.getElementById("search-results").style.display = "none";
}

// טעינת קובץ התחנות ברקע
async function fetchStopsFile() {
    try {
        const response = await fetch("${config.STOPS_FILE_URL}");
        if (!response.ok) throw new Error("Network error");
        ALL_STOPS = await response.json();
        console.log("Stops loaded:", ALL_STOPS.length);
    } catch (e) {
        console.error("Failed to load stops:", e);
    }
}

// לוגיקת גלילה - הצגת שורת חיפוש בגלילה למעלה
window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    const searchContainer = document.getElementById("search-container");
    
    // זיהוי גלילה למעלה משמעותית (יותר מ-10 פיקסלים)
    if (LAST_SCROLL_Y - currentScrollY > 10 && !IS_SEARCH_VISIBLE) {
        IS_SEARCH_VISIBLE = true;
        searchContainer.classList.add("visible");
    } 
    // הסתרה בגלילה למטה, אבל רק אם לא מקלידים כרגע
    else if (currentScrollY - LAST_SCROLL_Y > 10 && IS_SEARCH_VISIBLE && document.activeElement.id !== "search-input") {
        IS_SEARCH_VISIBLE = false;
        searchContainer.classList.remove("visible");
        document.getElementById("search-results").style.display = "none";
    }
    
    LAST_SCROLL_Y = currentScrollY;
});

// לוגיקת חיפוש
function initSearch() {
    const input = document.getElementById("search-input");
    const resultsDiv = document.getElementById("search-results");
    
    // טעינת הנתונים מיד בהתחלה
    fetchStopsFile();

    input.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        clearTimeout(SEARCH_TIMEOUT);
        
        if (val.length < 2) {
            resultsDiv.style.display = "none";
            return;
        }

        SEARCH_TIMEOUT = setTimeout(() => {
            performSearch(val);
        }, 300);
    });
}

function performSearch(query) {
    if (!ALL_STOPS.length) return;
    
    const resultsDiv = document.getElementById("search-results");
    const terms = query.split(/\s+/).filter(t => t.length > 0);
    
    // יצירת ביטויים רגולריים לכל מילה בחיפוש (Case Insensitive)
    const regexes = terms.map(t => {
        try { return new RegExp(t, 'i'); } catch(e) { return null; }
    }).filter(r => r);

    if (regexes.length === 0) return;

    // חיפוש וסינון
    const matches = ALL_STOPS.filter(stop => {
        // מחפשים בכל השדות הרלוונטיים
        const searchableText = (stop.stopName + " " + stop.stopCode + " " + stop.stopDesc).toLowerCase();
        
        // כל המילים חייבות להופיע (AND logic)
        return regexes.every(regex => regex.test(searchableText));
    });

    // דירוג התוצאות
    matches.sort((a, b) => {
        // דירוג 1: התאמה מדויקת בשם
        if (a.stopName === query) return -1;
        if (b.stopName === query) return 1;
        
        // דירוג 2: שם התחנה מתחיל בשאילתה
        const aStarts = a.stopName.toLowerCase().startsWith(query.toLowerCase());
        const bStarts = b.stopName.toLowerCase().startsWith(query.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // דירוג 3: שם קצר יותר (כנראה רלוונטי יותר)
        return a.stopName.length - b.stopName.length;
    });

    // הצגת תוצאות (מוגבל ל-20)
    renderSearchResults(matches.slice(0, 20));
}

function renderSearchResults(stops) {
    const resultsDiv = document.getElementById("search-results");
    resultsDiv.innerHTML = "";
    
    if (stops.length === 0) {
        resultsDiv.style.display = "none";
        return;
    }

    stops.forEach(stop => {
        const div = document.createElement("div");
        div.className = "search-item";
        div.innerHTML = \`
            <span class="s-code">\${stop.stopCode}</span>
            <div class="s-name">\${stop.stopName}</div>
            <div class="s-desc">\${stop.stopDesc || ''}</div>
        \`;
        div.onclick = () => selectStop(stop);
        resultsDiv.appendChild(div);
    });
    
    resultsDiv.style.display = "block";
}

function selectStop(stop) {
    // 1. הסתרת החיפוש
    document.getElementById("search-results").style.display = "none";
    document.getElementById("search-container").classList.remove("visible");
    IS_SEARCH_VISIBLE = false;
    
    // 2. עדכון UI - מציג טוען
    resetUI("טוען נתונים עבור " + stop.stopName + "...");
    
    // 3. שליחת פקודה ל-Scriptable לשנות מיקום ולרענן
    // שולחים את כל נתוני התחנה כדי להבטיח שהיא תוצג ראשונה
    notify("overrideLocation", {
        lat: stop.lat,
        lon: stop.lon,
        stopCode: stop.stopCode, // כדי לתעדף אותה
        stopName: stop.stopName
    });
}


// --- פונקציות מקוריות שנשמרות ---

function formatArrival(minutes) {
    if (minutes === 0) return "עכשיו";
    if (minutes < 0) return ""; 
    return minutes + " דק'";
}

window.resetUI = function(msg) {
  document.getElementById("content").innerHTML = \`
      <div id="loader-msg">
          <div class="spinner"></div>
          <div id="msg-text">\${msg || 'טוען נתונים...'}</div>
      </div>\`;
};

window.addStops = function(stops, clear) {
  const content = document.getElementById("content");
  if (clear || document.getElementById("loader-msg")) {
      content.innerHTML = "";
  }
  
  stops.forEach(stop => {
      // בדיקה אם כבר קיים
      if (document.getElementById("stop-" + stop.stopCode)) return;
      
      const div = document.createElement("div");
      div.className = "stop-container";
      div.id = "stop-" + stop.stopCode;
      div.innerHTML = \`
          <div class="stop-header">
              <div class="stop-name">\${stop.stopName || 'תחנה ' + stop.stopCode}</div>
              <div class="stop-code">\${stop.stopCode}</div>
          </div>
          <div class="cards-container" id="cards-\${stop.stopCode}">
             <div style="color:#6b7280; text-align:center; padding:10px;">טוען נסיעות...</div>
          </div>
      \`;
      content.appendChild(div);
  });
};

window.updateData = function(stopCode, data) {
    const container = document.getElementById("cards-" + stopCode);
    if (!container) return;
    
    if (!data || !data.groups || data.groups.length === 0) {
        container.innerHTML = '<div style="color:#6b7280; text-align:center; padding:10px;">אין נסיעות קרובות</div>';
        return;
    }
    
    container.innerHTML = "";
    
    data.groups.forEach(g => {
        const card = document.createElement("div");
        card.className = "line-card";
        
        let timesHtml = "";
        g.arrivals.forEach(a => {
           const timeClass = a.realtime ? (a.stale ? "time-chip stale" : "time-chip realtime") : "time-chip";
           timesHtml += \`
             <div class="\${timeClass}">
                \${a.realtime ? '<div class="pulse-dot" style="display:block"></div>' : ''}
                <span>\${formatArrival(a.minutes)}</span>
             </div>
           \`;
        });

        card.innerHTML = \`
            <div class="line-header">
                <span class="line-num">\${g.line}</span>
            </div>
            <div class="headsign">\${g.headsign}</div>
            <div class="times-row">\${timesHtml}</div>
        \`;
        container.appendChild(card);
    });
};

window.updateStopName = function(stopCode, name) {
    const el = document.querySelector("#stop-" + stopCode + " .stop-name");
    if(el) el.textContent = name;
};

// הפעלה ראשונית
initSearch();
`;

// ===============================
// HTML - מבנה הדף
// ===============================
var htmlBody = `
<header>
    <div class="header-top">
        <div id="scroll-area" style="flex-grow:1;"></div>
        <button id="refresh-btn" onclick="triggerRefresh()">
            <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        </button>
    </div>
    
    <div id="search-container">
        <div id="search-input-wrapper">
            <input type="text" id="search-input" placeholder="חפש תחנה (שם או מספר)..." autocomplete="off">
            <div id="search-results"></div>
        </div>
    </div>
</header>

<div id="content"></div>
`;

// ===============================
// ייצוא המודול
// ===============================
if (IS_SCRIPTABLE && typeof module !== 'undefined') {
  module.exports = {
    getHTML: function() {
        return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"/>
<style>${CSS_CONTENT}</style>
</head>
<body>
${htmlBody}
<script>${JS_CONTENT}</script>
</body>
</html>`;
    }
  };
}

if (IS_BROWSER) {
  window.KavNavUI = {
     // פונקציות לדפדפן אם צריך
  };
}
