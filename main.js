// main.js
// נקודת הכניסה שמנהלת את הכל

const config = importModule('config');
const utils = importModule('utils');
const dataService = importModule('data');
const viewService = importModule('view');

// נשתמש בפונקציה אסינכרונית כדי שנוכל לקרוא לה מבחוץ
module.exports.run = async function(argsObj) {
  
  // 1. קביעת מסלולים לפי התראה או ברירת מחדל
  let ROUTES = config.DEFAULT_ROUTES;
  const FROM_NOTIFICATION = (argsObj && argsObj.notification ? true : false);

  if (argsObj && argsObj.notification && argsObj.notification.userInfo) {
    const info = argsObj.notification.userInfo;
    if (Array.isArray(info.routeIds)) {
      ROUTES = info.routeIds.map((id) => ({ routeId: Number(id) }));
    }
  }

  // 2. תאריך
  const routeDate = utils.isoDateTodayLocal();

  // 3. טעינת נתונים סטטיים (מסלולים, תחנות, shape)
  const routesStatic = await dataService.fetchStaticRoutes(ROUTES, routeDate);

  // 4. הכנת ה-WebView
  const html = viewService.getHtml();
  const wv = new WebView();
  await wv.loadHTML(html);

  // 5. לולאת רענון
  let keepRefreshing = true;

  async function pushRealtimeOnce() {
    const payloads = await dataService.fetchRealtimeForRoutes(routesStatic);
    const js = `window.updateData(${JSON.stringify(payloads)});`;
    await wv.evaluateJavaScript(js, false);
  }

  async function refreshLoop() {
    await pushRealtimeOnce(); // פעם ראשונה מייד
    while (keepRefreshing) {
      await utils.sleep(config.REFRESH_INTERVAL_MS);
      if (!keepRefreshing) break;
      await pushRealtimeOnce();
    }
  }

  // התחלת הלולאה ברקע
  const loopPromise = refreshLoop();

  // הצגה
  if (FROM_NOTIFICATION) {
    await wv.present();
  } else {
    await wv.present(true);
  }

  // סיום
  keepRefreshing = false;
  try { await loopPromise; } catch (e) { console.error("Loop error: " + e); }
};
