# הגדרת דומיין עם SSL

## דרישות מוקדמות

1. **VPS עם גישה root**
2. **דומיין מצביע ל-VPS** (DNS A record)
3. **פורט 80 ו-443 פתוחים** ב-VPS firewall

## הגדרה מהירה

### שלב 1: הגדרת DNS

לך ל-panel של הדומיין שלך והוסף:

**A Record:**
```
Type: A
Name: scanner (או @)
Value: YOUR_VPS_IP
TTL: 3600
```

או **CNAME:**
```
Type: CNAME
Name: scanner
Value: your-existing-domain.com
TTL: 3600
```

**חשוב:** המתן 5-10 דקות עד ש-DNS מתעדכן!

### שלב 2: הרצת הסקריפט

```bash
cd scanner-nati
chmod +x setup-domain.sh
sudo ./setup-domain.sh scanner.yprods.com your-email@example.com
```

הסקריפט יעשה הכל אוטומטית:
- ✅ התקנת nginx
- ✅ התקנת certbot (Let's Encrypt)
- ✅ הגדרת reverse proxy
- ✅ יצירת אישור SSL
- ✅ הפעלת HTTPS

## הגדרה ידנית

### 1. התקנת nginx ו-certbot

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 2. יצירת קובץ הגדרות nginx

```bash
sudo nano /etc/nginx/sites-available/scanner.yprods.com
```

הוסף:

```nginx
server {
    listen 80;
    server_name scanner.yprods.com;

    client_max_body_size 10M;

    location / {
        proxy_pass https://localhost:3443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 3. הפעלת האתר

```bash
sudo ln -s /etc/nginx/sites-available/scanner.yprods.com /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 4. יצירת אישור SSL

```bash
sudo certbot --nginx -d scanner.yprods.com
```

ענה על השאלות:
- Email: הזן את האימייל שלך
- Agree to terms: Y
- Redirect HTTP to HTTPS: Y

### 5. בדיקה

פתח בדפדפן:
```
https://scanner.yprods.com
```

## עדכון אוטומטי של SSL

Let's Encrypt מתחדש אוטומטית, אבל אפשר לבדוק:

```bash
sudo certbot renew --dry-run
```

או להוסיף ל-crontab:
```bash
sudo crontab -e
```

הוסף:
```
0 0 * * * certbot renew --quiet
```

## פתרון בעיות

### DNS לא עובד

```bash
# בדוק DNS
dig scanner.yprods.com
nslookup scanner.yprods.com
```

### nginx לא מתחיל

```bash
# בדוק לוגים
sudo tail -f /var/log/nginx/error.log

# בדוק הגדרות
sudo nginx -t
```

### SSL לא נוצר

```bash
# בדוק שהפורט 80 פתוח
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# נסה שוב
sudo certbot --nginx -d scanner.yprods.com --dry-run
```

### השרת לא נגיש דרך nginx

```bash
# בדוק שהשרת רץ
pm2 status

# בדוק שהפורט 3443 פתוח מקומית
curl https://localhost:3443/health
```

## עדכון הגדרות השרת

אם שינית את הפורט של השרת, עדכן את nginx:

```bash
sudo nano /etc/nginx/sites-available/scanner.yprods.com
# שנה את proxy_pass ל: https://localhost:NEW_PORT
sudo nginx -t
sudo systemctl reload nginx
```

## גיבוי

```bash
# גיבוי הגדרות nginx
sudo cp /etc/nginx/sites-available/scanner.yprods.com ~/nginx-backup.conf

# גיבוי אישורי SSL
sudo cp -r /etc/letsencrypt ~/letsencrypt-backup
```

---

**מוכן!** עכשיו האתר שלך נגיש דרך `https://scanner.yprods.com` עם SSL אמיתי! 🎉

