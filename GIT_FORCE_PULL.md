# Force Pull מ-Git

## מה זה Force Pull?

Force pull מושך את כל השינויים מהמאגר המרוחק ומחליף את הקבצים המקומיים, גם אם יש שינויים מקומיים שלא נשמרו.

## ⚠️ אזהרה

זה ימחק את כל השינויים המקומיים שלא נשמרו ב-commit! ודא שאתה רוצה לעשות את זה.

## שיטות

### שיטה 1: Reset Hard (המומלץ)

```bash
# משוך את כל השינויים מהמאגר
git fetch origin

# החלף את כל הקבצים המקומיים בגרסה מהמאגר
git reset --hard origin/main
```

או אם ה-branch שלך נקרא אחרת:
```bash
git reset --hard origin/master
git reset --hard origin/develop
```

### שיטה 2: עם Clean (לניקוי קבצים לא נעקבים)

```bash
git fetch origin
git reset --hard origin/main
git clean -fd  # מוחק קבצים שלא ב-git
```

### שיטה 3: Pull עם Overwrite

```bash
git fetch origin
git reset --hard origin/main
git pull origin main --force
```

### שיטה 4: סקריפט מהיר

```bash
#!/bin/bash
git fetch origin
git reset --hard origin/main
git clean -fd
echo "✅ Force pull הושלם"
```

## לפי Branch

### אם אתה על main:
```bash
git fetch origin
git reset --hard origin/main
```

### אם אתה על master:
```bash
git fetch origin
git reset --hard origin/master
```

### אם אתה על branch אחר:
```bash
git fetch origin
git reset --hard origin/YOUR_BRANCH_NAME
```

## בדיקה לפני Force Pull

לפני שאתה עושה force pull, בדוק מה השינויים:

```bash
# ראה מה השתנה
git fetch origin
git diff HEAD origin/main

# ראה מה הקבצים המקומיים שלך
git status
```

## שחזור אחרי Force Pull

אם עשית force pull בטעות ורוצה לחזור:

```bash
# ראה את ה-history
git reflog

# חזור ל-commit קודם
git reset --hard HEAD@{1}
```

## Force Pull ב-VPS

אם אתה על VPS ורוצה לעדכן:

```bash
cd /path/to/scanner-nati
git fetch origin
git reset --hard origin/main
npm install  # עדכן תלויות אם צריך
pm2 restart inventory-server  # הפעל מחדש את השרת
```

## סקריפט אוטומטי לעדכון

צור קובץ `update.sh`:

```bash
#!/bin/bash
cd /path/to/scanner-nati
git fetch origin
git reset --hard origin/main
npm install
pm2 restart inventory-server
echo "✅ עדכון הושלם"
```

הרץ:
```bash
chmod +x update.sh
./update.sh
```

---

**זכור:** Force pull ימחק שינויים מקומיים שלא נשמרו ב-commit!

