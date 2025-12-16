# 🚀 מדריך התחלה מהירה - KavNav

## 📋 תוכן עניינים מהיר
1. [Scriptable (iOS)](#scriptable-ios)
2. [HTML מקומי](#html-מקומי)
3. [GitHub Pages](#github-pages)

---

## 1️⃣ Scriptable (iOS)

### צעדים:
1. **העלה** את כל הקבצים ל-GitHub
2. **פתח** Scriptable באייפון
3. **צור** סקריפט חדש
4. **העתק** את הקוד מ-`תחנות_קרובות_גיטאהב_מעודכן.js`
5. **עדכן** את השורה:
   ```javascript
   const REPO_RAW_BASE = "https://raw.githubusercontent.com/YOUR-USERNAME/YOUR-REPO/main/";
   ```
6. **שמור והרץ**! ✅

**זהו!** הסקריפט יוריד הכל אוטומטית.

---

## 2️⃣ HTML מקומי

### צעדים:
1. **הורד** את הפרויקט מ-GitHub
2. **פתח** `web/index.html` בדפדפן
3. **אשר** גישה למיקום אם מתבקש

**זהו!** זה עובד! ✅

**שים לב:** קריאות API עוברות דרך PROXY.

---

## 3️⃣ GitHub Pages

### צעדים:
1. **העלה** את הפרויקט ל-GitHub
2. **עבור** ל-Settings → Pages
3. **בחר** Source: `main` branch, Folder: `/ (root)`
4. **שמור**
5. **המתן** 1-2 דקות
6. **גש** ל-URL שמופיע (כמו `https://USERNAME.github.io/REPO/web/`)

**זהו!** זה אונליין! ✅

---

## ⚙️ התאמות בסיסיות

רוצה לשנות הגדרות? ערוך `KavNavConfig.js`:

```javascript
SEARCH_RADIUS: 500,        // רדיוס ב-מטרים
MAX_STATIONS: 5,           // כמה תחנות
REFRESH_INTERVAL_MS: 10000 // רענון ב-אלפיות שנייה
```

---

## 🆘 בעיות נפוצות

| בעיה | פתרון |
|------|--------|
| Scriptable: "Module not found" | בדוק את ה-URL ב-Loader |
| HTML: "Network error" | וודא שהדפדפן מאשר CORS או השתמש ב-Chrome |
| GitHub Pages: לא עובד | המתן 2-3 דקות, אז רענן |
| לא מוצא תחנות | אשר הרשאות מיקום בהגדרות |

---

## 📱 איך להוסיף ל-Home Screen (iOS)

1. פתח את האתר (GitHub Pages) ב-Safari
2. לחץ על כפתור השיתוף 📤
3. בחר **"Add to Home Screen"**
4. תן שם (לדוגמה: "KavNav")
5. לחץ **Add**

עכשיו יש לך אייקון כמו אפליקציה! 🎉

---

## 🎯 טיפ מקצועי

רוצה להשתמש במק"טים ספציפיים במקום GPS?

**ב-Scriptable:**
```javascript
args.shortcutParameter = { stopCodes: "12345,67890" };
```

**בדפדפן:**
```
https://USERNAME.github.io/REPO/web/?stopCodes=12345,67890
```

---

**עזרה נוספת?** קרא את ה-[README המלא](README.md) 📖
