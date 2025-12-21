// main.js
// נקודת הכניסה שמנהלת את הכל - מצב כפול (מפה + רשימת תחנות)

const config = importModule('config');
const utils = importModule('utils');
const dataService = importModule('data');
const viewService = importModule('view');

// ייבוא ה-API של פרויקט 2 (חייב להיות קיים בתיקייה)
const KavNavAPI = importModule('KavNavAPI'); 

module.exports.run = async function(argsObj) {

  const FROM_NOTIFICATION = !!(argsObj && argsObj.notification);
  const routeDate = utils.isoDateTodayLocal();

  // 1. אתחול משתנים
  let ROUTES = Array.isArray(config.DEFAULT_ROUTES)
    ? config.DEFAULT_ROUTES.map(r => ({ routeId: r.routeId }))
    : [];
  
  // טיפול בהתראות (לוגיקה מקורית של פרויקט 1)
  if (argsObj && argsObj.notification && argsObj.notification.userInfo) {
     // ... (קוד קיים לטיפול בהתראות - הושמט לקצר, העתק מהמקור אם צריך, אבל ברירת המחדל מספיקה)
  }

  // 2. יצירת WebView
  const wv = new WebView();
  const html = viewService.getHtml();
  await wv.loadHTML(html);

  // 3. הגדרות ונתונים סטטיים למפה (פרויקט 1)
  let routesStatic = [];
  try {
    // נשתמש במיקום התחלתי לשליפת נתונים בסיסיים אם יש
    routesStatic = await dataService.fetchStaticRoutes(ROUTES, routeDate);
    
    if (routesStatic.length) {
        const staticPayload = routesStatic.map(r => ({
          meta: {
            routeId: r.routeId,
            routeCode: r.routeCode,
            operatorColor: r.operatorColor,
            headsign: r.headsign,
            routeNumber: r.routeMeta?.routeNumber,
            routeDate: r.routeDate
          },
          stops: r.routeStops,
          shapeCoords: r.shapeCoords
        }));
        await wv.evaluateJavaScript(`window.initStaticData(${JSON.stringify(staticPayload)})`, false);
    }
  } catch (e) { console.error("Static routes error: " + e); }

  // 4. לולאת רענון משולבת (מפה + תחנות)
  let keepRefreshing = true;
  let lastLat = 0, lastLon = 0;

  async function refreshAll() {
    try {
        // --- א. קבלת מיקום נוכחי ---
        let userLat = null, userLon = null;
        try {
            Location.setAccuracyToBest();
            const loc = await Location.current();
            userLat = loc.latitude;
            userLon = loc.longitude;
        } catch(e) {
            // Fallback location
            const fallback = await utils.loadFallbackLocation();
            userLat = fallback.lat;
            userLon = fallback.lon;
        }

        if (userLat == null || userLon == null) return;

        // עדכון WebView במיקום
        const jsUserLoc = `if(window.setUserLocation) window.setUserLocation(${userLat}, ${userLon});`;
        await wv.evaluateJavaScript(jsUserLoc, false);

        // בדיקה אם זזנו מספיק כדי לרענן את רשימת התחנות הקרובות (פרויקט 2)
        const dist = Math.sqrt(Math.pow(userLat - lastLat, 2) + Math.pow(userLon - lastLon, 2));
        const MOVED_ENOUGH = dist > 0.002; // בערך 200 מטר

        // --- ב. טיפול בפרויקט 2 (רשימת תחנות) ---
        // נריץ את זה אם זזנו, או אם זו הריצה הראשונה
        if (MOVED_ENOUGH || lastLat === 0) {
             lastLat = userLat;
             lastLon = userLon;
             
             try {
                 // 1. מציאת תחנות קרובות דרך ה-API של פרויקט 2
                 const nearbyStops = await KavNavAPI.getNearbyStops(userLat, userLon);
                 
                 // 2. שליחת רשימת התחנות ל-JS
                 // הפונקציה addStops מוגדרת ב-app_stations.js
                 await wv.evaluateJavaScript(`if(window.addStops) window.addStops(${JSON.stringify(nearbyStops)}, true);`, false);
                 
                 // 3. (אופציונלי) טעינת נתונים לתחנה הראשונה מיידית
                 if (nearbyStops.length > 0) {
                     const firstCode = nearbyStops[0].stopCode;
                     const stopData = await KavNavAPI.getStopData(firstCode);
                     await wv.evaluateJavaScript(`if(window.updateData) window.updateData(${firstCode}, ${JSON.stringify(stopData)});`, false);
                 }
                 
             } catch(e) { console.error("Project 2 Logic Error: " + e); }
        }

        // --- ג. טיפול בפרויקט 1 (מפה - אוטובוסים זזים) ---
        // נשתמש בלוגיקה הקיימת של התחנות הקרובות למפה
        const nearestForMap = await dataService.findNearestStops(userLat, userLon, 3);
        let fullData;
        if (nearestForMap && nearestForMap.length > 0) {
            fullData = await dataService.fetchRealtimeForRoutesFromStops(routesStatic, nearestForMap);
        } else {
            fullData = await dataService.fetchRealtimeForRoutes(routesStatic);
        }
        
        const lightPayload = fullData.map(d => ({
            routeId: d.meta.routeId,
            meta: d.meta,
            vehicles: d.vehicles
        }));
        await wv.evaluateJavaScript(`if(window.updateRealtimeData) window.updateRealtimeData(${JSON.stringify(lightPayload)})`, false);

    } catch (e) {
        console.error("Refresh Loop Error: " + e);
    }
  }

  // התחלת הצגה
  if (FROM_NOTIFICATION) await wv.present();
  else await wv.present(true);

  // הרצה ראשונית + לולאה
  await refreshAll();
  
  while (keepRefreshing) {
    await utils.sleep(config.REFRESH_INTERVAL_MS);
    await refreshAll();
  }
};
