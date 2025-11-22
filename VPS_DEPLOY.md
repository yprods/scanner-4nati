# הוראות התקנה על VPS

## דרישות מוקדמות

- VPS עם Ubuntu/Debian
- גישה root או sudo
- חיבור SSH ל-VPS

## התקנה מהירה

### שלב 1: העלאת הקבצים ל-VPS

```bash
# מהמחשב המקומי
scp -r scanner-nati user@your-vps-ip:/path/to/destination/
```

או עם Git:
```bash
# ב-VPS
git clone YOUR_REPO_URL
cd scanner-nati
```

### שלב 2: הרצת סקריפט ההתקנה

```bash
# ב-VPS
cd scanner-nati
chmod +x deploy-vps.sh
sudo ./deploy-vps.sh
```

הסקריפט יעשה הכל אוטומטית:
- ✅ התקנת Node.js (אם חסר)
- ✅ התקנת PM2 (אם חסר)
- ✅ התקנת תלויות npm
- ✅ יצירת אישורי SSL
- ✅ הגדרת Firewall
- ✅ הפעלת השרת עם PM2
- ✅ הגדרת התחלה אוטומטית

## ניהול השרת

### צפייה בסטטוס
```bash
pm2 status
pm2 list
```

### צפייה בלוגים
```bash
pm2 logs inventory-server
pm2 logs inventory-server --lines 100
```

### הפעלה מחדש
```bash
pm2 restart inventory-server
```

### עצירה
```bash
pm2 stop inventory-server
```

### מחיקה
```bash
pm2 delete inventory-server
```

### מעקב בזמן אמת
```bash
pm2 monit
```

## הגדרת Firewall

### UFW (Ubuntu)
```bash
sudo ufw allow 3443/tcp
sudo ufw reload
```

### Firewalld (CentOS/RHEL)
```bash
sudo firewall-cmd --permanent --add-port=3443/tcp
sudo firewall-cmd --reload
```

## עדכון השרת

```bash
cd scanner-nati
git pull  # או העלה קבצים חדשים
npm install
pm2 restart inventory-server
```

## אישור SSL אמיתי (Let's Encrypt)

לפרודקשן, השתמש באישור אמיתי:

```bash
# התקנת Certbot
sudo apt-get update
sudo apt-get install certbot

# יצירת אישור
sudo certbot certonly --standalone -d your-domain.com

# עדכון השרת להשתמש באישור האמיתי
# ערוך את server-https.js והחלף את הנתיבים ל:
# /etc/letsencrypt/live/your-domain.com/privkey.pem
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
```

## פתרון בעיות

### השרת לא מתחיל
```bash
pm2 logs inventory-server --err
```

### פורט תפוס
```bash
# בדוק מה משתמש בפורט
sudo lsof -i :3443
# או
sudo netstat -tulpn | grep 3443
```

### PM2 לא מתחיל אוטומטית
```bash
pm2 startup
# הרץ את הפקודה שהפלט מציג
pm2 save
```

### בדיקת חיבור
```bash
curl https://localhost:3443/health
```

## גיבוי

```bash
# גיבוי מסד הנתונים
cp -r db/ db-backup-$(date +%Y%m%d)/

# גיבוי אישורי SSL
cp -r certs/ certs-backup-$(date +%Y%m%d)/
```

## אבטחה

1. **שנה את הפורט** אם צריך:
   ```bash
   export HTTPS_PORT=8443
   pm2 restart inventory-server
   ```

2. **הגבל גישה ל-IP מסוים** (ב-firewall)

3. **השתמש באישור SSL אמיתי** לפרודקשן

4. **עדכן את השרת** באופן קבוע

---

**מוכן!** השרת רץ על VPS עם PM2! 🚀

