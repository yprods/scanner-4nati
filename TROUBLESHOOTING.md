# פתרון בעיות נגישות שרת

## הבעיה: השרת רץ אבל לא נגיש מבחוץ

### שלב 1: בדיקה מהירה

הרץ את סקריפט הבדיקה:
```bash
chmod +x check-server.sh
./check-server.sh
```

או סקריפט התיקון האוטומטי:
```bash
chmod +x fix-access.sh
sudo ./fix-access.sh
```

---

## פתרונות נפוצים

### 1. פתיחת Firewall מקומי

#### UFW (Ubuntu/Debian):
```bash
sudo ufw allow 3443/tcp
sudo ufw reload
sudo ufw status  # בדיקה
```

#### Firewalld (CentOS/RHEL):
```bash
sudo firewall-cmd --permanent --add-port=3443/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports  # בדיקה
```

#### iptables (אם משתמש):
```bash
sudo iptables -A INPUT -p tcp --dport 3443 -j ACCEPT
sudo iptables-save
```

### 2. פתיחת Firewall ב-VPS Provider

#### AWS (Security Groups):
1. לך ל-EC2 > Security Groups
2. בחר את ה-Security Group של ה-VPS
3. Inbound Rules > Edit
4. הוסף: Type=Custom TCP, Port=3443, Source=0.0.0.0/0
5. Save

#### DigitalOcean (Firewall):
1. לך ל-Networking > Firewalls
2. בחר את ה-Firewall או צור חדש
3. Inbound Rules > Add Rule
4. Type=Custom, Protocol=TCP, Port Range=3443, Sources=All IPv4
5. Save

#### Google Cloud (Firewall Rules):
```bash
gcloud compute firewall-rules create allow-https-port \
    --allow tcp:3443 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow HTTPS port 3443"
```

#### Azure (Network Security Group):
1. לך ל-Network Security Groups
2. בחר את ה-NSG
3. Inbound security rules > Add
4. Service=Custom, Protocol=TCP, Port=3443, Action=Allow
5. Save

### 3. בדיקה שהשרת מאזין נכון

```bash
# בדוק מה מאזין על הפורט
sudo netstat -tulpn | grep 3443
# או
sudo ss -tulpn | grep 3443
```

אמור להראות משהו כמו:
```
tcp  0  0  0.0.0.0:3443  0.0.0.0:*  LISTEN  node
```

אם זה `127.0.0.1:3443` במקום `0.0.0.0:3443` - השרת לא נגיש מבחוץ!

### 4. בדיקת חיבור מה-VPS עצמו

```bash
# בדיקה מקומית
curl -k https://localhost:3443/health

# בדיקה עם IP מקומי
curl -k https://YOUR_LOCAL_IP:3443/health
```

אם זה עובד מקומית אבל לא מבחוץ - זה Firewall!

### 5. בדיקת PM2

```bash
# סטטוס
pm2 status

# לוגים
pm2 logs inventory-server

# בדיקה שהשרת רץ
pm2 describe inventory-server
```

### 6. בדיקת כתובת IP

```bash
# IP מקומי
hostname -I

# IP ציבורי
curl ifconfig.me
```

---

## בדיקות נוספות

### בדיקה 1: האם השרת רץ?
```bash
pm2 list
ps aux | grep server-https
```

### בדיקה 2: האם הפורט פתוח?
```bash
# מ-VPS עצמו
telnet localhost 3443

# מבחוץ (מהמחשב שלך)
telnet YOUR_VPS_IP 3443
```

### בדיקה 3: האם יש firewall נוסף?
```bash
# בדוק את כל ה-firewalls
sudo ufw status verbose
sudo firewall-cmd --list-all
sudo iptables -L -n
```

---

## פתרון מהיר - הכל בבת אחת

```bash
# 1. פתח Firewall
sudo ufw allow 3443/tcp && sudo ufw reload

# 2. הפעל מחדש את השרת
pm2 restart inventory-server

# 3. בדוק
curl -k https://localhost:3443/health
```

---

## אם עדיין לא עובד

1. **בדוק את ה-VPS provider** - יש firewall נוסף שם!
2. **בדוק את הלוגים**: `pm2 logs inventory-server`
3. **נסה פורט אחר**: שנה `HTTPS_PORT` ב-`pm2.config.js`
4. **בדוק אם יש proxy** או load balancer

---

## בדיקה סופית

מהמחשב שלך (לא מה-VPS):
```bash
curl -k https://YOUR_VPS_IP:3443/health
```

אמור להחזיר:
```json
{"status":"ok","message":"Server is running","protocol":"https",...}
```

אם זה לא עובד - הבעיה היא ב-Firewall של ה-VPS provider!

