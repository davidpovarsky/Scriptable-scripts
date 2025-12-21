# מבנה הפרויקט המחולק

## 📊 סקירה כללית

הפרויקט חולק למודולים עצמאיים לפי אחריות ופונקציונליות.

## 🗂️ תיקיות ראשיות

### `/` (שורש)
קבצי הליבה של Scriptable:
- **config.js** - הגדרות גלובליות (API, צבעים, ברירות מחדל)
- **utils.js** - פונקציות עזר (תאריכים, fetch, מיקום fallback)
- **data.js** - כל התקשורת עם השרת (תחנות, מסלולים, זמן אמת)
- **view.js** - מחולל HTML למערכת Scriptable
- **main.js** - נקודת הכניסה הראשית ב-Scriptable
- **kavnav-loader.js** - הסקריפט שמוריד ומריץ הכל

### `/modules/`
מודולים מודולריים שניתן לשימוש חוזר:

#### `/modules/map/`
הכל הקשור למפה:
- **mapManager.js** - ניהול Leaflet map, zoom, bounds
- **busMarkers.js** - ציור אייקוני אוטובוסים על המפה
- **userLocation.js** - ניהול מיקום משתמש, כפתור locate

#### `/modules/stops/`
ניהול תחנות:
- **nearbyPanel.js** - הפאנל הצדדי עם התחנות הקרובות

#### `/modules/routes/`
מסלולים וגרף:
- **bottomSheet.js** - ניהול ה-bottom sheet הניתן לגרירה
- **routeCard.js** - כרטיס מסלול בודד עם הגרף

#### `/modules/ui/`
רכיבי UI כלליים:
- **modeToggle.js** - כפתור המעבר בין מצב דואלי למפה בלבד
- **utils.js** - פונקציות עזר UI (צבעים, fetch)

### `/styles/`
קבצי CSS מחולקים לפי תחומים:
- **base.css** - סגנון בסיסי, משתנים, layout כללי
- **map.css** - סגנון המפה, אייקוני אוטובוס, כפתור locate
- **stops.css** - סגנון פאנל התחנות והבועות
- **routes.css** - סגנון bottom sheet, כרטיסים, גרף

### `/web/`
קבצים לשימוש בדפדפן:
- **index.html** - דף HTML ראשי (לפיתוח local)
- **app.js** - נקודת כניסה עם ES6 modules (לפיתוח modern)
- **app-bundled.js** - גרסה מאוחדת ללא modules (לשימוש ב-Scriptable)
- **style.css** - CSS עם imports (לפיתוח)
- **style-bundled.css** - CSS מאוחד (לשימוש ב-Scriptable)

## 🔄 תהליך הריצה

### ב-Scriptable (iOS):

```
┌─────────────────────┐
│  kavnav-loader.js   │  ← הסקריפט שאתה מריץ
└──────────┬──────────┘
           │
           ├─► Downloads all files from GitHub
           │   - config.js
           │   - utils.js
           │   - data.js
           │   - view.js
           │   - main.js
           │   - web/app-bundled.js
           │   - web/style-bundled.css
           │
           └─► importModule('main') → main.run(args)
                      │
                      ├─► קובע מסלולים (מההתראה או קרוב למיקום)
                      ├─► יוצר WebView עם view.getHtml()
                      ├─► מזריק JavaScript ו-CSS
                      ├─► שולח נתונים סטטיים (פעם אחת)
                      └─► לולאת רענון זמן אמת (כל 10 שניות)
```

### בדפדפן (Local):

```
┌─────────────────────┐
│  web/index.html     │  ← פותח בדפדפן
└──────────┬──────────┘
           │
           ├─► Loads style.css (with @imports)
           │   ├─► styles/base.css
           │   ├─► styles/map.css
           │   ├─► styles/stops.css
           │   └─► styles/routes.css
           │
           └─► Loads app.js (ES6 modules)
                   ├─► modules/map/mapManager.js
                   ├─► modules/map/busMarkers.js
                   ├─► modules/map/userLocation.js
                   ├─► modules/stops/nearbyPanel.js
                   ├─► modules/routes/bottomSheet.js
                   ├─► modules/routes/routeCard.js
                   ├─► modules/ui/modeToggle.js
                   └─► modules/ui/utils.js
```

## 🎯 זרימת נתונים

```
Scriptable (main.js)
     │
     ├─► Location.current() / loadFallbackLocation()
     │        └─► nearestStops = findNearestStops(lat, lon)
     │                 └─► activeRoutes = fetchActiveRoutesForStops(stopCodes)
     │
     ├─► routesStatic = fetchStaticRoutes(ROUTES)
     │        ├─► /api/route?routeId=X
     │        └─► /api/shapes?shapeIds=Y
     │
     └─► WebView
           ├─► window.initNearbyStops(stops)
           │        └─► nearbyPanel.init(stops)
           │
           ├─► window.initStaticData(staticPayload)
           │        ├─► staticDataStore.set(...)
           │        ├─► new RouteCard(...).create()
           │        └─► mapManager.fitBoundsToShapes(...)
           │
           └─► Loop: window.updateRealtimeData(updates)
                    ├─► mapManager.clearBuses()
                    ├─► routeCard.update(...)
                    ├─► busMarkers.drawBuses(...)
                    └─► nearbyPanel.updateTimes(...)
```

## 🧩 יתרונות החלוקה

### 1. תחזוקה קלה
כל מודול אחראי על תחום ספציפי. רוצה לשנות את עיצוב התחנות? עבוד רק על `nearbyPanel.js` ו-`stops.css`.

### 2. בדיקות (Testing)
אפשר לבדוק כל מודול בנפרד:
```javascript
const mapManager = new MapManager();
mapManager.init();
// test methods...
```

### 3. שימוש חוזר
אפשר להשתמש במודולים בפרויקטים אחרים:
```javascript
import { MapManager } from './modules/map/mapManager.js';
```

### 4. עבודת צוות
מפתחים שונים יכולים לעבוד על מודולים שונים במקביל ללא קונפליקטים.

### 5. קוד נקי
כל קובץ קצר ומובן. הקובץ הארוך ביותר הוא `app-bundled.js` (מאוחד) - כ-900 שורות.

## 🔍 דוגמאות לעריכה

### להוסיף תחנה אהובה לפאנל:

ערוך `modules/stops/nearbyPanel.js`:
```javascript
_createStopBubble(stop, isActive = false) {
  // הוסף כפתור כוכב
  const starBtn = '<button class="star-btn">⭐</button>';
  // ...
}
```

### לשנות צבע אוטובוס:

ערוך `modules/map/busMarkers.js`:
```javascript
_createBusIconHtml(bearing, color, routeNumber) {
  // שנה את ה-color או הוסף אפקטים
  // ...
}
```

### להוסיף אנימציה לכרטיס:

ערוך `styles/routes.css`:
```css
.route-card {
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## 🚦 סדר טעינה

### Scriptable (רצף הורדה):
1. config.js
2. utils.js
3. data.js
4. view.js
5. main.js
6. web/app-bundled.js
7. web/style-bundled.css

### Browser (רצף טעינה):
1. HTML parsed
2. CSS loaded (parallel)
3. Leaflet loaded
4. DOMContentLoaded fired
5. app.js modules loaded (parallel)
6. Classes instantiated
7. Event listeners attached
8. Ready! 🎉

## 📝 סיכום

המבנה החדש מאפשר:
- ✅ קוד מסודר ומובן
- ✅ תחזוקה קלה
- ✅ הרחבה פשוטה
- ✅ עבודה בצוות
- ✅ שימוש חוזר במודולים
- ✅ תמיכה מלאה הן ב-Scriptable והן בדפדפן

המעבר מהגרסה המקורית (קובץ אחד ענק) לגרסה המודולרית הזו משפר משמעותית את איכות הקוד ואת יכולת התחזוקה!
