# 📤 הוראות העלאה לגיטהאב

## קבצים חיוניים להעלאה

העלה את הקבצים הבאים **בלבד** לתיקיית `kavnav/` בגיטהאב:

### ✅ קבצי שורש (7 קבצים)
```
kavnav/
├── config.js
├── utils.js
├── data.js
├── view.js
├── main.js
├── kavnav-loader.js
└── README.md
```

### ✅ תיקיית web (2 קבצים)
```
kavnav/web/
├── app-bundled.js
└── style-bundled.css
```

### 🎯 סה"כ: 9 קבצים בלבד!

## ⚠️ קבצים שלא צריך להעלות

הקבצים הבאים נועדו **לפיתוח מקומי בלבד** ולא נדרשים ל-Scriptable:

```
❌ web/index.html           (רק לפיתוח בדפדפן)
❌ web/app.js               (רק לפיתוח עם modules)
❌ web/style.css            (רק לפיתוח עם imports)
❌ modules/**               (נכללים ב-app-bundled.js)
❌ styles/**                (נכללים ב-style-bundled.css)
```

## 🚀 שלבי העלאה

### אופציה 1: דרך ממשק הגיטהאב

1. **צור תיקייה חדשה** בשם `kavnav` בריפו שלך
2. **העלה את 9 הקבצים** (השתמש ב-Upload files)
3. **ודא את המבנה:**
   ```
   YOUR-REPO/
   └── kavnav/
       ├── config.js
       ├── utils.js
       ├── data.js
       ├── view.js
       ├── main.js
       ├── kavnav-loader.js
       ├── README.md
       └── web/
           ├── app-bundled.js
           └── style-bundled.css
   ```

### אופציה 2: דרך Git CLI

```bash
# 1. נווט לריפו המקומי שלך
cd /path/to/your/repo

# 2. צור תיקיית kavnav
mkdir -p kavnav/web

# 3. העתק את הקבצים החיוניים
cp /path/to/kavnav-refactored/config.js kavnav/
cp /path/to/kavnav-refactored/utils.js kavnav/
cp /path/to/kavnav-refactored/data.js kavnav/
cp /path/to/kavnav-refactored/view.js kavnav/
cp /path/to/kavnav-refactored/main.js kavnav/
cp /path/to/kavnav-refactored/kavnav-loader.js kavnav/
cp /path/to/kavnav-refactored/README.md kavnav/
cp /path/to/kavnav-refactored/web/app-bundled.js kavnav/web/
cp /path/to/kavnav-refactored/web/style-bundled.css kavnav/web/

# 4. הוסף לגיט
git add kavnav/

# 5. Commit
git commit -m "Add KavNav refactored project"

# 6. Push
git push origin main
```

## 🔧 עדכון kavnav-loader.js

לאחר ההעלאה, **חובה** לעדכן את ה-URL ב-`kavnav-loader.js`:

```javascript
// שנה את זה:
const REPO_URL = "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/refs/heads/main/kavnav/";

// ל:
const REPO_URL = "https://raw.githubusercontent.com/YOUR-USERNAME/YOUR-REPO/main/kavnav/";
```

### דוגמה:
אם הריפו שלך הוא: `https://github.com/johndoe/my-scripts`

אז ה-URL יהיה:
```javascript
const REPO_URL = "https://raw.githubusercontent.com/johndoe/my-scripts/main/kavnav/";
```

## ✅ אימות

לאחר ההעלאה, בדוק שה-URLs הבאים עובדים:

1. `https://raw.githubusercontent.com/YOUR-USERNAME/YOUR-REPO/main/kavnav/config.js`
2. `https://raw.githubusercontent.com/YOUR-USERNAME/YOUR-REPO/main/kavnav/web/app-bundled.js`

אם אתה מקבל טקסט מעוצב (לא 404), הכל בסדר! ✅

## 🎮 שימוש ב-Scriptable

### התקנה ראשונה:

1. **פתח Scriptable** באייפון
2. **צור סקריפט חדש** (`+` למעלה מימין)
3. **תן לו שם:** "KavNav" או "KavNav Loader"
4. **העתק את התוכן** מקובץ `kavnav-loader.js`
5. **עדכן את ה-REPO_URL** לשלך
6. **שמור והרץ** ✅

### עדכון גרסה:

פשוט הרץ את הסקריפט שוב - הוא יוריד את הקבצים העדכניים מגיטהאב!

## 🐛 פתרון בעיות

### שגיאה: "Failed to download..."

1. בדוק שה-REPO_URL נכון
2. ודא שהקבצים הועלו למיקום הנכון
3. נסה לגשת ל-URL ידנית בדפדפן

### שגיאה: "Error loading main module"

1. ודא ש-`main.js` הועלה
2. בדוק שאין שגיאות Syntax ב-console
3. נסה למחוק ולהעלות מחדש

### הסקריפט לא מוצא קבצים:

בדוק שהמבנה נכון:
```
kavnav/
├── main.js          ← חובה
├── config.js        ← חובה
├── ...
└── web/
    ├── app-bundled.js   ← חובה
    └── style-bundled.css ← חובה
```

## 📦 גודל הפרויקט

- **קבצי JavaScript:** ~60KB
- **קבצי CSS:** ~8KB
- **סה"כ:** ~68KB בלבד!

זמן הורדה: פחות משנייה עם חיבור רגיל 📶

## 🎉 סיימת!

עכשיו הפרויקט שלך:
- ✅ מאורגן ומסודר
- ✅ קל לתחזוקה
- ✅ מודולרי וגמיש
- ✅ עובד הן ב-Scriptable והן בדפדפן
- ✅ עוקב אחרי best practices

**Happy Coding! 🚀**
