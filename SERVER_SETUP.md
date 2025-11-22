# הוראות הפעלת השרת

## הבעיה שתוקנה

השרת היה מאזין רק על `localhost`, מה שאומר שהוא היה נגיש רק מהמחשב המקומי. עכשיו הוא מאזין על `0.0.0.0` ונגיש ממכשירים אחרים ברשת.

## הפעלת השרת

```bash
cd scanner-nati
npm install  # אם עדיין לא התקנת
npm start    # או npm run dev לפיתוח
```

## כתובות גישה

לאחר הפעלת השרת, תראה הודעות כמו:

```
🚀 השרת פעיל!
   מקומי: http://localhost:3000
   רשת:   http://192.168.1.100:3000
   API:    http://192.168.1.100:3000/api
```

### גישה מהמחשב המקומי
- פתח דפדפן וגש ל: `http://localhost:3000`

### גישה ממכשיר אחר ברשת
1. ודא שהמכשיר והשרת באותה רשת WiFi
2. השתמש בכתובת ה-IP שמוצגת בהודעה (לדוגמה: `http://192.168.1.100:3000`)
3. באפליקציית המובייל, עדכן את `API_BASE_URL` ב-`mobile-app/services/api.js`:

```javascript
const API_BASE_URL = __DEV__ 
  ? 'http://192.168.1.100:3000/api'  // החלף ב-IP האמיתי שלך
  : 'https://your-server.com/api';
```

## פתרון בעיות

### השרת לא נגיש ממכשירים אחרים

1. **בדוק Firewall:**
   - Windows: ודא ש-Windows Firewall מאפשר חיבורים נכנסים על פורט 3000
   - פתח PowerShell כמנהל והרץ:
     ```powershell
     New-NetFirewallRule -DisplayName "Node Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
     ```

2. **בדוק שהמכשירים באותה רשת:**
   - ודא שהמחשב והמכשיר מחוברים לאותה רשת WiFi
   - בדוק את כתובת ה-IP של המחשב:
     ```bash
     # Windows
     ipconfig
     
     # Linux/Mac
     ifconfig
     ```

3. **בדוק שהשרת רץ:**
   - פתח דפדפן במחשב המקומי וגש ל-`http://localhost:3000`
   - אם זה עובד, השרת תקין

### מציאת כתובת IP

**Windows:**
```powershell
ipconfig | findstr IPv4
```

**Linux/Mac:**
```bash
ifconfig | grep "inet "
```

או פשוט תסתכל על ההודעה שהשרת מציג כשאתה מפעיל אותו!

## גישה מהאינטרנט (לפרודקשן)

להפוך את השרת לנגיש מהאינטרנט:

1. **השתמש בשירות כמו ngrok:**
   ```bash
   npm install -g ngrok
   ngrok http 3000
   ```
   זה ייתן לך כתובת URL ציבורית

2. **או העלה לשרת ענן:**
   - Heroku
   - DigitalOcean
   - AWS
   - Azure

3. **עדכן את האפליקציה:**
   - שנה את `API_BASE_URL` ב-`mobile-app/services/api.js` לכתובת השרת הציבורי

---

**טיפ:** לפיתוח, השתמש ב-`npm run dev` כדי שהשרת יתחיל מחדש אוטומטית בכל שינוי בקוד.

