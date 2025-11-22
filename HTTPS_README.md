# הוראות הפעלת שרת HTTPS

## למה צריך HTTPS?

Safari ב-iOS **דורש HTTPS** לגישה למצלמה (חוץ מ-localhost). לכן צריך להפעיל את השרת עם HTTPS כדי שהמצלמה תעבוד ב-iPhone.

## התקנה מהירה

### שלב 1: יצירת אישורי SSL
```bash
npm run setup:https
```

או:
```bash
node setup-https.js
```

זה יוצר:
- תיקיית `certs/` עם אישורי SSL
- `key.pem` - מפתח פרטי
- `cert.pem` - אישור SSL

### שלב 2: הפעלת השרת עם HTTPS
```bash
npm run start:https
```

או:
```bash
node server-https.js
```

השרת יעלה על פורט **3443** (במקום 3000).

## שימוש

### מהמחשב המקומי:
```
https://localhost:3443
```

### ממכשיר אחר ברשת:
```
https://YOUR_IP:3443
```

(החלף `YOUR_IP` בכתובת ה-IP שהשרת מציג)

## אזהרת אבטחה בדפדפן

כיוון שזהו **self-signed certificate**, הדפדפן יציג אזהרת אבטחה. זה נורמלי וצפוי!

**Chrome/Edge:**
1. לחץ "מתקדם" (Advanced)
2. לחץ "המשך לאתר" (Proceed to site)

**Firefox:**
1. לחץ "מתקדם" (Advanced)
2. לחץ "קבל סיכון והמשך" (Accept the Risk and Continue)

**Safari (Mac):**
1. לחץ "המשך לאתר" (Show Details > Visit Website)

**Safari (iPhone):**
1. לחץ "מתקדם"
2. לחץ "המשך לאתר"

## פיתוח עם auto-reload

```bash
npm run dev:https
```

זה יפעיל את השרת עם nodemon (auto-reload) על HTTPS.

## פתרון בעיות

### "אישורי SSL לא נמצאו"
```bash
npm run setup:https
```

### "פורט תפוס"
השרת ינסה אוטומטית את הפורטים הבאים: 3443, 3444, 3445...

או שנה את הפורט:
```bash
HTTPS_PORT=4000 npm run start:https
```

### הדפדפן לא מאפשר להתעלם מהאזהרה
- ודא שאתה לוחץ על "מתקדם" ולא רק סוגר את החלון
- נסה דפדפן אחר
- או התקן את האישור במערכת (מתקדם יותר)

## הערות חשובות

1. **אישור Self-Signed:** זהו אישור לא מאומת - זה בסדר לפיתוח אבל לא לפרודקשן
2. **לפרודקשן:** השתמש באישור אמיתי מ-Let's Encrypt או ספק אחר
3. **אבטחה:** האישור תקף ל-365 ימים
4. **פורט:** ברירת מחדל הוא 3443, אבל ניתן לשנות

## בדיקה שהכל עובד

1. הפעל: `npm run start:https`
2. פתח דפדפן וגש ל: `https://localhost:3443`
3. התעלם מאזהרת האבטחה
4. בדוק שהמצלמה עובדת!

---

**מוכן!** עכשיו השרת רץ עם HTTPS והמצלמה תעבוד ב-iPhone Safari! 🎉

