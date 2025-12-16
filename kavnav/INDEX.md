# 📦 KavNav - פרויקט מוכן לשימוש!

## 🎉 מה יש כאן?

פרויקט **KavNav** שעובד בשלושה מקומות:
1. ✅ **Scriptable** (iOS)
2. ✅ **HTML מקומי** (פתיחה ישירה בדפדפן)
3. ✅ **GitHub Pages** (אתר מתארח)

---

## 📁 רשימת קבצים

### קבצים משותפים (Core)
```
✅ KavNavConfig.js      - הגדרות וקבועים
✅ KavNavHelpers.js     - פונקציות עזר
✅ KavNavAPI.js         - לוגיקת נתונים + PROXY
✅ KavNavUI.js          - בניית HTML חכם
✅ KavNavMain.js        - לוגיקה ראשית
```

### קבצים ייחודיים
```
✅ תחנות_קרובות_גיטאהב_מעודכן.js  - Loader ל-Scriptable
✅ web/index.html                  - דף HTML לדפדפן
✅ web/app.js                      - JavaScript לדפדפן
✅ web/style.css                   - עיצוב
```

### תיעוד
```
📖 README.md          - מדריך מלא ומפורט
🚀 QUICKSTART.md      - התחלה מהירה
✅ CHECKLIST.md       - רשימת בדיקות לפני פרסום
📋 INDEX.md           - הקובץ הזה
```

### אופציונלי
```
🔧 .github/workflows/deploy.yml  - GitHub Actions (אוטומציה)
🚫 .gitignore                     - קבצים להתעלמות
```

---

## 🚀 איך מתחילים?

### אופציה 1: רוצה להתחיל **מהר**? 
👉 פתח את [QUICKSTART.md](QUICKSTART.md)

### אופציה 2: רוצה הסבר **מפורט**?
👉 פתח את [README.md](README.md)

### אופציה 3: רוצה **לבדוק** שהכל תקין?
👉 פתח את [CHECKLIST.md](CHECKLIST.md)

---

## 📂 איך מעלים ל-GitHub?

### דרך 1: דרך ממשק GitHub (קל)
1. צור ריפו חדש ב-GitHub
2. לחץ על "uploading an existing file"
3. גרור את **כל** הקבצים (כולל תיקיית `web/`)
4. לחץ "Commit changes"

### דרך 2: דרך Git (מתקדם)
```bash
git init
git add .
git commit -m "Initial commit - KavNav project"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

---

## ⚙️ התאמות נדרשות

### חובה לשנות:
1. **ב-`תחנות_קרובות_גיטאהב_מעודכן.js`** (שורה 9):
   ```javascript
   const REPO_RAW_BASE = "https://raw.githubusercontent.com/YOUR-USERNAME/YOUR-REPO/main/";
   ```
   שנה `YOUR-USERNAME` ו-`YOUR-REPO` לשלך!

### אופציונלי:
2. **ב-`KavNavConfig.js`** - שנה פרמטרים כמו:
   - `SEARCH_RADIUS` (רדיוס חיפוש)
   - `MAX_STATIONS` (מספר תחנות)
   - `REFRESH_INTERVAL_MS` (תדירות רענון)

---

## 🎯 מה כל קובץ עושה?

| קובץ | תפקיד | נדרש ל-Scriptable? | נדרש לדפדפן? |
|------|-------|-------------------|--------------|
| KavNavConfig.js | הגדרות כלליות | ✅ | ✅ |
| KavNavHelpers.js | פונקציות עזר | ✅ | ✅ |
| KavNavAPI.js | קריאות API | ✅ | ✅ |
| KavNavUI.js | בניית HTML | ✅ | ✅ |
| KavNavMain.js | לוגיקה ראשית | ✅ | ✅ |
| תחנות_קרובות...js | Loader | ✅ | ❌ |
| web/index.html | דף HTML | ❌ | ✅ |
| web/app.js | UI לדפדפן | ❌ | ✅ |
| web/style.css | עיצוב | ❌ | ✅ |

---

## 🧩 מבנה הפרויקט ב-GitHub

כך זה אמור להיראות ב-GitHub שלך:

```
YOUR-REPO/
├── KavNavConfig.js
├── KavNavHelpers.js
├── KavNavAPI.js
├── KavNavUI.js
├── KavNavMain.js
├── תחנות_קרובות_גיטאהב_מעודכן.js
├── web/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── README.md
├── QUICKSTART.md
├── CHECKLIST.md
├── INDEX.md
├── .gitignore
└── .github/
    └── workflows/
        └── deploy.yml
```

---

## 🔍 איך לבדוק שהכל עובד?

### 1. Scriptable
```
✅ פתח Scriptable
✅ צור סקריפט חדש
✅ העתק את הקוד מ-Loader
✅ עדכן את ה-URL
✅ הרץ
```

### 2. HTML מקומי
```
✅ פתח web/index.html בדפדפן
✅ אשר גישה למיקום
✅ תחנות נטענות
```

### 3. GitHub Pages
```
✅ Settings → Pages → Enable
✅ המתן 2-3 דקות
✅ פתח את ה-URL
```

---

## 💡 טיפים חשובים

1. **לא עובד ב-Scriptable?**
   - בדוק את ה-URL ב-Loader
   - מחק את תיקיית `kavnav` מ-iCloud Drive

2. **לא עובד בדפדפן מקומי?**
   - וודא שה-PROXY פעיל
   - נסה Chrome (התמיכה הכי טובה)

3. **לא עובד ב-GitHub Pages?**
   - המתן 2-3 דקות אחרי הפעלה
   - בדוק ב-Developer Console (F12) אם יש שגיאות

4. **רוצה לעדכן?**
   - שנה את הקבצים ב-GitHub
   - Scriptable יוריד אוטומטית אחרי 12 שעות
   - או מחק את תיקיית `kavnav` מ-iCloud כדי לאלץ עדכון

---

## 🆘 צריך עזרה?

1. 📖 קרא את [README.md](README.md) המלא
2. 🚀 עבור על [QUICKSTART.md](QUICKSTART.md)
3. ✅ השתמש ב-[CHECKLIST.md](CHECKLIST.md) לבדיקות
4. 🐛 בדוק את ה-Console (F12) לשגיאות

---

## 🎊 זהו!

הפרויקט מוכן לשימוש! תהנה מזמני הגעה בזמן אמת 🚍

**הצלחה!** 🚀
