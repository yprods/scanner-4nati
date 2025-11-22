#!/bin/bash

# סקריפט לעדכון השרת מ-Git

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PM2_APP_NAME="inventory-server"
BRANCH="${1:-main}"  # ברירת מחדל: main

# צבעים
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

cd "$PROJECT_DIR" || {
    print_error "לא ניתן לעבור לתיקיית הפרויקט"
    exit 1
}

print_info "מתחיל עדכון מ-Git..."
print_warning "זה ימחק שינויים מקומיים שלא נשמרו ב-commit!"

# בדיקה אם זה git repository
if [ ! -d ".git" ]; then
    print_error "זו לא תיקיית Git!"
    exit 1
fi

# שמירת שינויים מקומיים (אם יש)
print_info "בודק שינויים מקומיים..."
if [ -n "$(git status --porcelain)" ]; then
    print_warning "יש שינויים מקומיים שלא נשמרו!"
    read -p "האם להמשיך? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "בוטל"
        exit 0
    fi
fi

# Force pull
print_info "מושך שינויים מ-origin/$BRANCH..."
git fetch origin

if [ $? -ne 0 ]; then
    print_error "שגיאה ב-git fetch"
    exit 1
fi

print_info "מחליף קבצים מקומיים..."
git reset --hard "origin/$BRANCH"

if [ $? -ne 0 ]; then
    print_error "שגיאה ב-git reset"
    exit 1
fi

# ניקוי קבצים לא נעקבים
print_info "מנקה קבצים לא נעקבים..."
git clean -fd

# עדכון תלויות
print_info "מעדכן תלויות npm..."
npm install

if [ $? -ne 0 ]; then
    print_warning "שגיאה בהתקנת תלויות, אבל ממשיך..."
fi

# הפעלה מחדש של PM2
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        print_info "מפעיל מחדש את השרת..."
        pm2 restart "$PM2_APP_NAME"
        
        if [ $? -eq 0 ]; then
            print_success "השרת הופעל מחדש"
        else
            print_warning "שגיאה בהפעלה מחדש של השרת"
        fi
    else
        print_warning "השרת לא רץ ב-PM2"
    fi
fi

print_success "עדכון הושלם!"
echo ""
print_info "סטטוס Git:"
git status
echo ""
print_info "סטטוס PM2:"
pm2 status "$PM2_APP_NAME" 2>/dev/null || echo "PM2 לא מותקן או השרת לא רץ"

