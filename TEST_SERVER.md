# בדיקת השרת

## איך לבדוק שהשרת עובד

### 1. הפעל את השרת
```bash
cd scanner-nati
npm start
```

### 2. בדוק מהדפדפן המקומי
פתח דפדפן וגש ל:
- `http://localhost:3000` - דף הבית
- `http://localhost:3000/health` - בדיקת תקינות (אמור להחזיר JSON)
- `http://localhost:3000/api/stats` - סטטיסטיקות

### 3. בדוק מהמכשיר/מחשב אחר ברשת

**מצא את כתובת ה-IP:**
השרת יציג הודעה כמו:
```
🚀 השרת פעיל!
   מקומי: http://localhost:3000
   רשת:   http://192.168.1.100:3000
   API:    http://192.168.1.100:3000/api
```

**בדוק מהמכשיר:**
- פתח דפדפן במכשיר
- גש ל: `http://192.168.1.100:3000/health`
- אמור לראות: `{"status":"ok","message":"Server is running",...}`

### 4. פתרון בעיות

**אם לא רואה את השרת:**

1. **בדוק שהשרת רץ:**
   ```bash
   # בדוק שהתהליך רץ
   netstat -ano | findstr :3000
   ```

2. **פתח Firewall:**
   ```powershell
   # הרץ ב-PowerShell כמנהל
   New-NetFirewallRule -DisplayName "Node Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```

3. **בדוק שהמכשירים באותה רשת:**
   - המחשב והמכשיר חייבים להיות באותה WiFi

4. **נסה IP אחר:**
   ```bash
   # מצא את כל ה-IPs
   ipconfig
   ```
   נסה את כל ה-IPs שמופיעים תחת WiFi או Ethernet

### 5. בדיקת API

**מהדפדפן:**
```javascript
// פתח Console בדפדפן (F12) והרץ:
fetch('http://localhost:3000/api/stats')
  .then(r => r.json())
  .then(console.log)
```

**מהמכשיר:**
החלף `localhost` ב-IP המקומי שלך

---

**אם עדיין לא עובד**, שלח את ההודעה שהשרת מציג ואת הודעת השגיאה.

