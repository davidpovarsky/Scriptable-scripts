// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: magic;

const Config = importModule('KavNavConfig');
const Helpers = importModule('KavNavHelpers');
const API = importModule('KavNavAPI');
const UI = importModule('KavNavUI');

/* ===================== STATE ===================== */

// אנחנו שומרים על State דינמי בקובץ הראשי
let STATE = {
  stops: [],
  currentLoc: null,
  stopLoop: false,
  isDirectMode: false,
  mainLoopRunning: false,
  // כדי לאפשר שינוי פרמטרים תוך כדי ריצה
  radius: Config.SEARCH_RADIUS,
  maxStops: Config.MAX_STATIONS
};

/* ===================== CONTROLLER LOGIC ===================== */

async function main() {
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
}

async function handleCommand(cmd, wv) {
  if (cmd === "refreshLocation") {
    STATE.stopLoop = true;
    await Helpers.sleep(500);
    STATE.stopLoop = false;
    STATE.stops = [];
    STATE.isDirectMode = false;
    // איפוס רדיוס
    STATE.radius = Config.SEARCH_RADIUS;
    STATE.maxStops = Config.MAX_STATIONS;
    
    await wv.evaluateJavaScript(`window.resetUI("מחפש מיקום מחדש...")`);
    initLocationMode(wv);
  }
  
  if (cmd === "loadMore") {
    if (STATE.isDirectMode) {
        const a = new Alert();
        a.title = "מצב מק\"ט ידני";
        a.message = "האם לעבור לחיפוש לפי מיקום?";
        a.addAction("כן");
        a.addCancelAction("ביטול");
        if (await a.presentAlert() === 0) handleCommand("refreshLocation", wv);
        return;
    }
    STATE.radius += 500;
    STATE.maxStops += 5;
    
    if (STATE.currentLoc) {
      const moreStops = await API.findNearbyStops(STATE.currentLoc.lat, STATE.currentLoc.lon, STATE.stops, STATE.maxStops, STATE.radius);
      moreStops.forEach(s => STATE.stops.push(s)); 
      const js = `window.addStops(${JSON.stringify(moreStops)}, false)`;
      await wv.evaluateJavaScript(js);
      updateLoop(wv, moreStops);
    }
  }
}

async function initDirectMode(wv, codes) {
  const stops = codes.map(c => ({ name: "טוען...", stopCode: c, distance: 0 }));
  STATE.stops = stops;
  await wv.evaluateJavaScript(`window.addStops(${JSON.stringify(stops)}, true)`);
  updateLoop(wv, stops);
}

async function initLocationMode(wv) {
  const loc = await API.getLocation();
  if (!loc) {
     await wv.evaluateJavaScript(`window.resetUI("שגיאה בקבלת מיקום")`);
     return;
  }
  STATE.currentLoc = loc;
  await wv.evaluateJavaScript(`document.getElementById("msg-text").innerText = "מחפש תחנות..."`);

  const stops = await API.findNearbyStops(loc.lat, loc.lon, [], STATE.maxStops, STATE.radius);
  if (stops.length === 0) {
    await wv.evaluateJavaScript(`window.resetUI("לא נמצאו תחנות בסביבה")`);
    return;
  }
  
  STATE.stops = stops;
  await wv.evaluateJavaScript(`window.addStops(${JSON.stringify(stops)}, true)`);
  updateLoop(wv, stops);
}

async function updateLoop(wv, stopsToUpdate) {
  const fetchAndSend = async (stopCode) => {
    try {
      const data = await API.getStopData(stopCode);
      if (data.name && STATE.isDirectMode) {
         wv.evaluateJavaScript(`window.updateStopName("${stopCode}", "${data.name}")`).catch(()=>{});
      }
      await wv.evaluateJavaScript(`window.updateData("${stopCode}", ${JSON.stringify(data)})`);
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
    for (const s of [...STATE.stops]) {
      if (STATE.stopLoop) break;
      await fetchAndSend(s.stopCode);
    }
  }
  STATE.mainLoopRunning = false;
}

await main();
Script.complete();
