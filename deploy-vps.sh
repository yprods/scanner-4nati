#!/bin/bash

# ================= הגדרות =================
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_VERSION="18"
PM2_APP_NAME="inventory-server"
HTTPS_PORT="${HTTPS_PORT:-3443}"

# צבעים להודעות
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# פונקציה להדפסת הודעות
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

# ================= בדיקת הרשאות =================
if [ "$EUID" -ne 0 ]; then 
    print_warning "הסקריפט צריך הרשאות root לחלק מהפעולות"
    print_info "אם תתבקש סיסמה, הזן אותה"
fi

# ================= התקנת Node.js =================
print_info "בודק התקנת Node.js..."

if ! command -v node &> /dev/null; then
    print_warning "Node.js לא מותקן. מתקין..."
    
    # התקנת Node.js דרך NodeSource
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    if [ $? -eq 0 ]; then
        print_success "Node.js הותקן בהצלחה"
    else
        print_error "שגיאה בהתקנת Node.js"
        exit 1
    fi
else
    NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    print_success "Node.js כבר מותקן (גרסה $NODE_VER)"
fi

# ================= התקנת PM2 =================
print_info "בודק התקנת PM2..."

if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 לא מותקן. מתקין..."
    sudo npm install -g pm2
    
    if [ $? -eq 0 ]; then
        print_success "PM2 הותקן בהצלחה"
    else
        print_error "שגיאה בהתקנת PM2"
        exit 1
    fi
else
    print_success "PM2 כבר מותקן"
fi

# ================= מעבר לתיקיית הפרויקט =================
print_info "מעבר לתיקיית הפרויקט: $PROJECT_DIR"
cd "$PROJECT_DIR" || {
    print_error "לא ניתן לעבור לתיקיית הפרויקט"
    exit 1
}

# ================= התקנת תלויות =================
print_info "מתקין תלויות npm..."

if [ ! -d "node_modules" ]; then
    npm install
    
    if [ $? -eq 0 ]; then
        print_success "תלויות הותקנו בהצלחה"
    else
        print_error "שגיאה בהתקנת תלויות"
        exit 1
    fi
else
    print_info "תלויות כבר מותקנות. מעדכן..."
    npm install
fi

# ================= יצירת אישורי SSL =================
print_info "בודק אישורי SSL..."

CERT_DIR="$PROJECT_DIR/certs"
KEY_PATH="$CERT_DIR/key.pem"
CERT_PATH="$CERT_DIR/cert.pem"

if [ ! -f "$KEY_PATH" ] || [ ! -f "$CERT_PATH" ]; then
    print_warning "אישורי SSL לא נמצאו. יוצר..."
    
    node setup-https.js
    
    if [ $? -eq 0 ]; then
        print_success "אישורי SSL נוצרו בהצלחה"
    else
        print_error "שגיאה ביצירת אישורי SSL"
        exit 1
    fi
else
    print_success "אישורי SSL כבר קיימים"
fi

# ================= יצירת תיקיות נדרשות =================
print_info "בודק תיקיות נדרשות..."

mkdir -p "$PROJECT_DIR/db"
mkdir -p "$PROJECT_DIR/public"
mkdir -p "$(dirname "$(mktemp -u)")/uploads"

print_success "תיקיות מוכנות"

# ================= הגדרת Firewall =================
print_info "בודק הגדרות Firewall..."

if command -v ufw &> /dev/null; then
    print_info "מאפשר פורט $HTTPS_PORT ב-ufw..."
    sudo ufw allow $HTTPS_PORT/tcp 2>/dev/null || true
    print_success "Firewall מוגדר"
elif command -v firewall-cmd &> /dev/null; then
    print_info "מאפשר פורט $HTTPS_PORT ב-firewalld..."
    sudo firewall-cmd --permanent --add-port=$HTTPS_PORT/tcp 2>/dev/null || true
    sudo firewall-cmd --reload 2>/dev/null || true
    print_success "Firewall מוגדר"
else
    print_warning "לא נמצא firewall manager. ודא שהפורט $HTTPS_PORT פתוח"
fi

# ================= עצירת PM2 אם כבר רץ =================
print_info "בודק אם השרת כבר רץ ב-PM2..."

if pm2 list | grep -q "$PM2_APP_NAME"; then
    print_warning "השרת כבר רץ. עוצר..."
    pm2 stop "$PM2_APP_NAME" 2>/dev/null || true
    pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
    sleep 2
fi

# ================= יצירת תיקיית לוגים =================
mkdir -p "$PROJECT_DIR/logs"

# ================= הפעלת השרת עם PM2 =================
print_info "מפעיל את השרת עם PM2..."

# בדיקה אם יש קובץ config
if [ -f "$PROJECT_DIR/pm2.config.js" ]; then
    print_info "משתמש ב-pm2.config.js"
    pm2 start pm2.config.js
    
    if [ $? -eq 0 ]; then
        print_success "השרת הופעל עם PM2 (מ-config)"
    else
        print_error "שגיאה בהפעלת השרת"
        exit 1
    fi
else
    print_info "מפעיל ישירות..."
    pm2 start server-https.js \
        --name "$PM2_APP_NAME" \
        --interpreter node \
        --max-memory-restart 500M \
        --log-date-format "YYYY-MM-DD HH:mm:ss Z" \
        --merge-logs \
        --error-log "$PROJECT_DIR/logs/error.log" \
        --out-log "$PROJECT_DIR/logs/out.log" \
        --env HTTPS_PORT=$HTTPS_PORT
    
    if [ $? -eq 0 ]; then
        print_success "השרת הופעל עם PM2"
    else
        print_error "שגיאה בהפעלת השרת"
        exit 1
    fi
fi

# ================= שמירת הגדרות PM2 =================
print_info "שומר הגדרות PM2 להתחלה אוטומטית..."

pm2 save

# הגדרת PM2 להתחיל אוטומטית בעת אתחול
if ! pm2 startup | grep -q "already"; then
    STARTUP_CMD=$(pm2 startup | grep -v "PM2" | grep -v "=" | tail -1)
    if [ ! -z "$STARTUP_CMD" ]; then
        print_info "מגדיר PM2 להתחיל אוטומטית..."
        eval "$STARTUP_CMD"
    fi
else
    print_success "PM2 כבר מוגדר להתחלה אוטומטית"
fi

# ================= הצגת סטטוס =================
echo ""
print_success "ההתקנה הושלמה בהצלחה!"
echo ""
print_info "סטטוס השרת:"
pm2 status "$PM2_APP_NAME"
echo ""
print_info "לוגים:"
print_info "  pm2 logs $PM2_APP_NAME"
print_info "  pm2 logs $PM2_APP_NAME --lines 50"
echo ""
print_info "ניהול:"
print_info "  pm2 restart $PM2_APP_NAME    # הפעלה מחדש"
print_info "  pm2 stop $PM2_APP_NAME       # עצירה"
print_info "  pm2 delete $PM2_APP_NAME    # מחיקה"
print_info "  pm2 monit                    # מעקב בזמן אמת"
echo ""

# קבלת כתובת IP
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "YOUR_VPS_IP")
LOCAL_IP=$(hostname -I | awk '{print $1}')

print_info "כתובות גישה:"
echo "  מקומי:  https://localhost:$HTTPS_PORT"
echo "  רשת:    https://$LOCAL_IP:$HTTPS_PORT"
if [ "$PUBLIC_IP" != "YOUR_VPS_IP" ]; then
    echo "  ציבורי: https://$PUBLIC_IP:$HTTPS_PORT"
fi
echo ""
print_warning "זכור: זהו אישור self-signed. הדפדפן יציג אזהרת אבטחה."
print_info "לפרודקשן, השתמש באישור אמיתי מ-Let's Encrypt"
echo ""

