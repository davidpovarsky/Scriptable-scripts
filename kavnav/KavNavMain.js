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
  overriddenLoc: null, // מיקום שנבחר ידנית מהחיפוש
  stopLoop: false,
  isDirectMode: false,
  mainLoopRunning: false,
  radius: Config.SEARCH_RADIUS,
  maxStops: Config.MAX_STATIONS
};

// ===============================
// לוגיקה ראשית
// ===============================

async function main() {
  if (IS_SCRIPTABLE) {
    let wv = new WebView();
    await wv.loadHTML(UI.getHTML());
    
    // טיפול בפקודות מה-HTML (כמו בחירת תחנה בחיפוש)
    wv.shouldAllowRequest = (req) => {
        if (req.url.startsWith("kavnav://")) {
            handleWebViewCommand(req.url, wv);
            return false;
        }
        return true;
    };
    
    // הרצה ראשונית
    await refresh(wv);
    
    wv.present();
  } else {
    // Browser logic
    console.log("Running in browser mode");
  }
}

// פונקציה המטפלת בפקודות מה-WebView
async function handleWebViewCommand(url, wv) {
    const urlObj = new URL(url.replace("kavnav://", "https://dummy/")); // Hack to parse custom scheme
    const cmd = url.replace("kavnav://", "").split("?")[0];
    const dataStr = urlObj.searchParams.get("data");
    const data = dataStr ? JSON.parse(decodeURIComponent(dataStr)) : null;

    if (cmd === "refreshLocation") {
        // המשתמש לחץ על כפתור הרענון - חזרה ל-GPS
        STATE.overriddenLoc = null;
        await refresh(wv);
    } 
    else if (cmd === "overrideLocation" && data) {
        // המשתמש בחר תחנה בחיפוש
        STATE.stopLoop = true; // עצירת לולאה קודמת אם רצה
        await Helpers.sleep(500); // המתנה קצרה
        STATE.stopLoop = false;
        
        // הגדרת המיקום המזויף
        STATE.overriddenLoc = { lat: data.lat, lon: data.lon };
        
        // אופציונלי: שמירת קוד התחנה שנבחרה כדי לתעדף אותה במיון (לא מיושם ב-API כרגע אבל המרחק יעשה את שלו)
        await refresh(wv, data.stopCode);
    }
}

async function refresh(wv, focusStopCode = null) {
  STATE.stopLoop = true; 
  // המתנה שהלולאה הקודמת תסיים
  if (STATE.mainLoopRunning) {
      await Helpers.sleep(Config.REFRESH_INTERVAL_MS + 500);
  }
  STATE.stopLoop = false;

  let loc;
  
  if (STATE.overriddenLoc) {
      // שימוש במיקום שנבחר מהחיפוש
      loc = STATE.overriddenLoc;
      // נדמה שהמיקום הוא כאילו המשתמש שם
  } else {
      // שימוש ב-GPS אמיתי
      try {
        Location.setAccuracyToBest();
        loc = await Location.current();
      } catch (e) {
        console.log("Location Error: " + e);
        loc = null;
      }
  }

  if (!loc) {
    await wv.evaluateJavaScript(`window.resetUI("שגיאה בקבלת מיקום")`);
    return;
  }
  
  STATE.currentLoc = loc;
  
  // אם אנחנו במצב רגיל
  if (!STATE.overriddenLoc) {
      await wv.evaluateJavaScript(`document.getElementById("msg-text").innerText = "מחפש תחנות..."`);
  }

  // חיפוש תחנות קרובות סביב המיקום (האמיתי או הנבחר)
  let stops = await API.findNearbyStops(loc.latitude || loc.lat, loc.longitude || loc.lon, [], STATE.maxStops, STATE.radius);
  
  if (stops.length === 0) {
    await wv.evaluateJavaScript(`window.resetUI("לא נמצאו תחנות בסביבה")`);
    return;
  }

  // אם יש תחנה ממוקדת (שנבחרה בחיפוש), וודא שהיא ראשונה
  if (focusStopCode) {
      const idx = stops.findIndex(s => s.stopCode == focusStopCode);
      if (idx > -1) {
          const s = stops.splice(idx, 1)[0];
          stops.unshift(s);
      } else {
          // אם התחנה לא נמצאה ברדיוס (מוזר, כי המיקום שלנו הוא התחנה), נוסיף אותה ידנית
          // (בדרך כלל לא יקרה אם הרדיוס תקין והקואורדינטות ב-JSON נכונות)
      }
  }

  STATE.stops = stops;
  await wv.evaluateJavaScript(`window.addStops(${JSON.stringify(stops)}, true)`);
  
  // התחלת לולאת העדכון
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
    
    // רענון חוזר של התחנות המוצגות
    for (const s of STATE.stops) {
        if (STATE.stopLoop) break;
        await fetchAndSend(s.stopCode);
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
}
