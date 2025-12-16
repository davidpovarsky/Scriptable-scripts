# 🚍 KavNav - זמני הגעה בזמן אמת

פרויקט משולב שעובד גם ב-**Scriptable** (iOS) וגם כ-**דף HTML** (דפדפן).

---

## 📁 מבנה הפרויקט

```
kavnav/
├── KavNavConfig.js                              # הגדרות וקבועים (משותף)
├── KavNavHelpers.js                             # פונקציות עזר (משותף)
├── KavNavAPI.js                                 # לוגיקת נתונים + תמיכה ב-PROXY (משותף)
├── KavNavUI.js                                  # בניית HTML חכם לפי סביבה (משותף)
├── KavNavMain.js                                # לוגיקה ראשית (משותף)
├── תחנות_קרובות_גיטאהב_מעודכן.js               # Loader ל-Scriptable בלבד
└── web/
    ├── index.html                               # דף HTML לדפדפן
    ├── app.js                                   # JavaScript לדפדפן
    └── style.css                                # עיצוב

```

---

## 🎯 איך זה עובד?

### זיהוי סביבה אוטומטי

כל קובץ JS מזהה אם הוא רץ ב-Scriptable או בדפדפן:

```javascript
const IS_SCRIPTABLE = typeof FileManager !== 'undefined';
const IS_BROWSER = !IS_SCRIPTABLE;
```

### קריאות API עם PROXY

- **Scriptable**: קריאות ישירות ל-API
- **HTML מקומי** (`file://`): דרך Google Apps Script PROXY
- **GitHub Pages**: קריאות ישירות ל-API

---

## 🚀 התקנה והפעלה

### 1️⃣ העלאה ל-GitHub

העלה את כל הקבצים לריפו GitHub שלך:

```
https://github.com/USERNAME/REPO/
├── KavNavConfig.js
├── KavNavHelpers.js
├── KavNavAPI.js
├── KavNavUI.js
├── KavNavMain.js
├── תחנות_קרובות_גיטאהב_מעודכן.js
└── web/
    ├── index.html
    ├── app.js
    └── style.css
```

**חשוב:** וודא ש:
- הקבצים נמצאים בתיקיית root או בתת-תיקייה עקבית
- ה-URL בקובץ הLoader תואם את המיקום שלך ב-GitHub

---

### 2️⃣ שימוש ב-Scriptable (iOS)

#### שלב א: יצירת סקריפט חדש
1. פתח את אפליקציית **Scriptable**
2. לחץ על **+** ליצירת סקריפט חדש
3. תן לו שם (לדוגמה: "KavNav")

#### שלב ב: העתקת הקוד
1. פתח את הקובץ `תחנות_קרובות_גיטאהב_מעודכן.js`
2. **עדכן את השורה** עם ה-URL שלך:
   ```javascript
   const REPO_RAW_BASE = "https://raw.githubusercontent.com/USERNAME/REPO/main/";
   ```
3. העתק את כל הקוד לסקריפט ב-Scriptable
4. שמור

#### שלב ג: הרצה
- לחץ על הסקריפט
- הוא יוריד אוטומטית את כל המודולים מ-GitHub
- יפתח את ממשק המשתמש

**רענון מודולים:**
- המערכת בודקת עדכונים אוטומטית כל 12 שעות
- ניתן לשנות את `UPDATE_EVERY_HOURS` בקובץ הLoader

---

### 3️⃣ שימוש כ-HTML מקומי

#### שלב א: הורדת הקבצים
1. הורד את כל הפרויקט מ-GitHub
2. שמור אותו בתיקייה במחשב שלך

#### שלב ב: פתיחה בדפדפן
1. עבור לתיקייה `web/`
2. פתח את `index.html` בדפדפן (Chrome / Firefox / Safari)

**הערה חשובה:**
- כל קריאות ה-API יעברו דרך ה-PROXY (בגלל מגבלות CORS)
- יתכן שהדפדפן יבקש אישור למיקום GPS

---

### 4️⃣ פריסה ב-GitHub Pages

#### שלב א: הפעלת GitHub Pages
1. עבור לריפו שלך ב-GitHub
2. לחץ על **Settings**
3. גלול ל-**Pages**
4. תחת **Source** בחר `main` branch
5. תחת **Folder** בחר `/root` או `/docs` (לפי המבנה שלך)
6. לחץ **Save**

#### שלב ב: גישה לאתר
- GitHub יספק לך URL כמו:
  ```
  https://USERNAME.github.io/REPO/web/
  ```
- פתח את ה-URL בדפדפן

**יתרון:**
- קריאות API ישירות (ללא PROXY!)
- עובד על כל מכשיר עם דפדפן

---

## ⚙️ התאמות והגדרות

### שינוי פרמטרים

ערוך את `KavNavConfig.js`:

```javascript
module.exports = {
  BASE_URL: "https://kavnav.com/api",
  SEARCH_RADIUS: 500,           // רדיוס חיפוש במטרים
  MAX_STATIONS: 5,               // מספר תחנות להציג
  LOOKAHEAD_MINUTES: 60,         // כמה זמן קדימה להציג
  REFRESH_INTERVAL_MS: 10000,    // רענון כל 10 שניות
  // ...
};
```

### שינוי PROXY

אם יש לך PROXY משלך, ערוך את:

```javascript
PROXY_URL: "https://YOUR-PROXY-URL/exec?url=",
```

---

## 🧩 ארכיטקטורה

### קבצים משותפים (עובדים בכל מקום)
- **KavNavConfig.js**: הגדרות + זיהוי סביבה
- **KavNavHelpers.js**: פונקציות עזר כלליות
- **KavNavAPI.js**: שליפת נתונים מ-API + PROXY
- **KavNavUI.js**: בונה HTML שונה לפי סביבה
- **KavNavMain.js**: לוגיקה ראשית + WebView / DOM

### קבצים ייחודיים
- **תחנות_קרובות_גיטאהב_מעודכן.js**: רק ל-Scriptable (Loader)
- **web/index.html**: רק לדפדפן (נקודת כניסה)
- **web/app.js**: רק לדפדפן (UI logic)
- **web/style.css**: רק לדפדפן (עיצוב)

---

## 🔧 Troubleshooting

### בעיות ב-Scriptable

**"Module not found"**
- וודא שה-`REPO_RAW_BASE` נכון
- בדוק שהקבצים בתיקייה הנכונה ב-GitHub
- נסה למחוק את תיקיית `kavnav` מ-iCloud Drive/Scriptable

**"לא מוצאים תחנות"**
- בדוק הרשאות מיקום ב-iOS
- נסה לאשר מחדש גישה למיקום

### בעיות בדפדפן מקומי

**"Network error"**
- וודא שה-PROXY עובד (בדוק ב-console)
- נסה דפדפן אחר

**"לא מבקש מיקום"**
- בדפדפנים מודרניים, Geolocation עובד רק ב-HTTPS או localhost
- העלה ל-GitHub Pages או השתמש ב-local server

### בעיות ב-GitHub Pages

**"404 Not Found"**
- וודא שהנתיב נכון (`/web/index.html`)
- בדוק ש-GitHub Pages מופעל

**"קריאות API נכשלות"**
- בדוק ב-Developer Console
- יתכן שיש בעיית CORS מצד השרת

---

## 📝 תיעוד טכני

### Flow ב-Scriptable
```
1. תחנות_קרובות_גיטאהב_מעודכן.js (Loader)
   ↓ מוריד מודולים מ-GitHub
2. KavNavMain.js
   ↓ יוצר WebView
3. KavNavUI.buildHTML()
   ↓ מחזיר HTML עם inline CSS+JS
4. WebView מתחיל לרוץ
5. Loop: API → updateData → UI
```

### Flow בדפדפן
```
1. index.html נטען
   ↓ טוען JS files
2. KavNavConfig/Helpers/API נטענים ל-window
3. KavNavMain.main() רץ
   ↓ לא יוצר WebView, משתמש ב-DOM
4. Loop: API (דרך PROXY אם local) → updateData → UI
```

---

## 🤝 תרומה

רוצה לשפר? מוזמן!

1. Fork את הריפו
2. צור branch חדש
3. עשה שינויים
4. פתח Pull Request

---

## 📄 רישיון

MIT License - חופשי לשימוש ושינוי.

---

## 👨‍💻 יוצר

נוצר על ידי [השם שלך] 🚀

---

## ✨ תודות

- **KavNav API** - https://kavnav.com
- **Scriptable** - https://scriptable.app
- **OpenStreetMap** - נתוני תחנות

---

**נהנית מהפרויקט? תן ⭐ ב-GitHub!**
