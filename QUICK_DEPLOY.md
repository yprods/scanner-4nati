# התקנה מהירה על VPS

## 3 שלבים:

### 1️⃣ העלה את הקבצים ל-VPS
```bash
scp -r scanner-nati user@your-vps:/home/user/
```

### 2️⃣ התחבר ל-VPS
```bash
ssh user@your-vps
cd scanner-nati
```

### 3️⃣ הרץ את הסקריפט
```bash
chmod +x deploy-vps.sh
sudo ./deploy-vps.sh
```

**זה הכל!** השרת יעלה אוטומטית עם PM2.

## בדיקה

```bash
pm2 status
pm2 logs inventory-server
```

## כתובת הגישה

הסקריפט יציג את הכתובת בסוף. בדרך כלל:
```
https://YOUR_VPS_IP:3443
```

---

**לפרטים נוספים:** ראה `VPS_DEPLOY.md`

