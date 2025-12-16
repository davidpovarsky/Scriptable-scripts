// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: magic;

// KavNavMain.js - לוגיקה ראשית משותפת ל-Scriptable ודפדפן

// ===============================
// זיהוי סביבה וטעינת תלויות
// ===============================
var IS_SCRIPTABLE = typeof window !== 'undefined' ? window.IS_SCRIPTABLE : (typeof FileManager !== 'undefined');
var IS_BROWSER = typeof window !== 'undefined' ? window.IS_BROWSER : false;

var Config, Helpers, API, UI;

if (IS_SCRIPTABLE) {
  Config = importModule('kavnav/KavNavConfig');
  Helpers = importModule('kavnav/KavNavHelpers');
  API = importModule('kavnav/KavNavAPI');
  UI = importModule('kavnav/KavNavUI');
} else {
  // בדפדפן - השתמש ישירות מ-window (ללא הגדרה מחדש)
  if (typeof window.KavNavConfig !== 'undefined') {
    Config = window.KavNavConfig;
    Helpers = window.KavNavHelpers;
    API = window.KavNavAPI;
    UI = window.KavNavUI;
  }
}

// ===============================
// STATE
// ===============================
var STATE = {
  stops: [],
  currentLoc: null,
  stopLoop: false,
  isDirectMode: false,
  mainLoopRunning: false,
  radius: Config.SEARCH_RADIUS,
  maxStops: Config.MAX_STATIONS,
  activeStopCode: null
};

// ===============================
// CONTROLLER LOGIC
// ===============================
async function main() {
  if (IS_SCRIPTABLE) {
    // Scriptable - WebView
    const wv = new WebView();
    await wv.loadHTML(UI.buildHTML());

    wv.shouldAllowRequest = (req) => {
      if (req.url.startsWith("kavnav://")) {
        const cmd = req.url.replace("kavnav://", "");
        handleCommand(cmd, wv);
        return false;
      }
      return true;
    };

    const params = args.shortcutParameter || {};
    let directCodes = null;
    
    if (params.stopCodes) {
       directCodes = String(params.stopCodes).split(",").map(s => s.trim());
    } else if (typeof params === "string" && params.match(/^\d+(,\d+)*$/)) {
       directCodes = params.split(",");
    }

    if (directCodes && directCodes.length > 0) {
      STATE.isDirectMode = true;
      initDirectMode(wv, directCodes);
    } else {
      STATE.isDirectMode = false;
      initLocationMode(wv);
    }

    await wv.present(true);
  } else {
    // Browser - DOM רגיל
    // הפונקציה handleCommand נרשמת ב-window
    window.handleCommand = (cmd) => handleCommand(cmd, null);
    
    // בדיקה אם יש פרמטרים ב-URL
    const urlParams = new URLSearchParams(window.location.search);
    const stopCodesParam = urlParams.get('stopCodes');
    
    if (stopCodesParam) {
      const directCodes = stopCodesParam.split(",").map(s => s.trim());
      STATE.isDirectMode = true;
      initDirectMode(null, directCodes);
    } else {
      STATE.isDirectMode = false;
      initLocationMode(null);
    }
  }
}

async function handleCommand(cmd, wv) {
  if (cmd.startsWith("setActiveStop/")) {
    const code = cmd.split("/")[1];
    STATE.activeStopCode = code;
    return;
  }

  if (cmd === "refreshLocation") {
    STATE.stopLoop = true;
    await Helpers.sleep(500);
    STATE.stopLoop = false;
    STATE.stops = [];
    STATE.isDirectMode = false;
    STATE.radius = Config.SEARCH_RADIUS;
    STATE.maxStops = Config.MAX_STATIONS;
    STATE.activeStopCode = null;
    
    await executeJS(wv, `window.resetUI("מחפש מיקום מחדש...")`);
    initLocationMode(wv);
  }
  
  if (cmd === "loadMore") {
    if (STATE.isDirectMode) {
      if (IS_SCRIPTABLE) {
        const a = new Alert();
        a.title = "מצב מק\"ט ידני";
        a.message = "האם לעבור לחיפוש לפי מיקום?";
        a.addAction("כן");
        a.addCancelAction("ביטול");
        if (await a.presentAlert() === 0) handleCommand("refreshLocation", wv);
      } else {
        if (confirm("האם לעבור לחיפוש לפי מיקום?")) {
          handleCommand("refreshLocation", wv);
        }
      }
      return;
    }
    STATE.radius += 500;
    STATE.maxStops += 5;
    
    if (STATE.currentLoc) {
      const moreStops = await API.findNearbyStops(STATE.currentLoc.lat, STATE.currentLoc.lon, STATE.stops, STATE.maxStops, STATE.radius);
      moreStops.forEach(s => STATE.stops.push(s)); 
      const js = `window.addStops(${JSON.stringify(moreStops)}, false)`;
      await executeJS(wv, js);
      updateLoop(wv, moreStops);
    }
  }
}

// פונקציית עזר להרצת JS - Scriptable או Browser
async function executeJS(wv, jsCode) {
  if (IS_SCRIPTABLE && wv) {
    return await wv.evaluateJavaScript(jsCode);
  } else if (IS_BROWSER) {
    return eval(jsCode);
  }
}

async function initDirectMode(wv, codes) {
  const stops = codes.map(c => ({ name: "טוען...", stopCode: c, distance: 0 }));
  STATE.stops = stops;
  
  if (stops.length > 0) STATE.activeStopCode = stops[0].stopCode;

  await executeJS(wv, `window.addStops(${JSON.stringify(stops)}, true)`);
  updateLoop(wv, stops);
}

async function initLocationMode(wv) {
  const loc = await API.getLocation();
  if (!loc) {
     await executeJS(wv, `window.resetUI("שגיאה בקבלת מיקום")`);
     return;
  }
  STATE.currentLoc = loc;
  await executeJS(wv, `document.getElementById("msg-text").innerText = "מחפש תחנות..."`);

  const stops = await API.findNearbyStops(loc.lat, loc.lon, [], STATE.maxStops, STATE.radius);
  if (stops.length === 0) {
    await executeJS(wv, `window.resetUI("לא נמצאו תחנות בסביבה")`);
    return;
  }
  
  STATE.stops = stops;
  
  if (stops.length > 0) STATE.activeStopCode = stops[0].stopCode;

  await executeJS(wv, `window.addStops(${JSON.stringify(stops)}, true)`);
  updateLoop(wv, stops);
}

async function updateLoop(wv, stopsToUpdate) {
  const fetchAndSend = async (stopCode) => {
    try {
      const data = await API.getStopData(stopCode);
      if (data.name && STATE.isDirectMode) {
         executeJS(wv, `window.updateStopName("${stopCode}", "${data.name}")`).catch(()=>{});
      }
      await executeJS(wv, `window.updateData("${stopCode}", ${JSON.stringify(data)})`);
    } catch (e) {
      console.log(`Error ${stopCode}: ${e}`);
    }
  };

  for (const s of stopsToUpdate) {
    if (STATE.stopLoop) return;
    await fetchAndSend(s.stopCode);
  }

  if (STATE.mainLoopRunning) return; 
  STATE.mainLoopRunning = true;

  while (!STATE.stopLoop) {
    await Helpers.sleep(Config.REFRESH_INTERVAL_MS);
    
    if (STATE.activeStopCode) {
        if (STATE.stopLoop) break;
        await fetchAndSend(STATE.activeStopCode);
    }
  }
  STATE.mainLoopRunning = false;
}

// ===============================
// הרצה
// ===============================
if (IS_SCRIPTABLE) {
  // Scriptable - הרץ מיד
  (async () => {
    await main();
    Script.complete();
  })();
} else {
  // Browser - המתן לטעינת DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
}

// Export לשימוש חיצוני
if (IS_SCRIPTABLE) {
  module.exports = { main };
} else {
  window.KavNavMain = { main };
}
