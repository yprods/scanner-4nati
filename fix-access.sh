#!/bin/bash

# סקריפט לתיקון בעיות נגישות

HTTPS_PORT="${HTTPS_PORT:-3443}"

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

echo "=========================================="
echo "  תיקון בעיות נגישות שרת"
echo "=========================================="
echo ""

# 1. פתיחת Firewall
print_info "1. פותח Firewall..."

if command -v ufw &> /dev/null; then
    print_info "משתמש ב-UFW..."
    sudo ufw allow $HTTPS_PORT/tcp
    sudo ufw reload
    print_success "פורט $HTTPS_PORT נפתח ב-UFW"
elif command -v firewall-cmd &> /dev/null; then
    print_info "משתמש ב-firewalld..."
    sudo firewall-cmd --permanent --add-port=$HTTPS_PORT/tcp
    sudo firewall-cmd --reload
    print_success "פורט $HTTPS_PORT נפתח ב-firewalld"
else
    print_warning "לא נמצא firewall manager - פתח ידנית"
fi
echo ""

# 2. בדיקה שהשרת מאזין על 0.0.0.0
print_info "2. בודק הגדרות השרת..."
if grep -q "listen(port, '0.0.0.0'" server-https.js; then
    print_success "השרת מוגדר להאזין על 0.0.0.0"
else
    print_warning "השרת לא מוגדר להאזין על 0.0.0.0"
    print_info "עדכן את server-https.js שורה 381:"
    print_info "  .listen(port, '0.0.0.0', ...)"
fi
echo ""

# 3. הפעלה מחדש של השרת
print_info "3. מפעיל מחדש את השרת..."
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "inventory-server"; then
        pm2 restart inventory-server
        sleep 2
        print_success "השרת הופעל מחדש"
    else
        print_warning "השרת לא רץ ב-PM2"
        print_info "הפעל עם: pm2 start server-https.js --name inventory-server"
    fi
else
    print_warning "PM2 לא מותקן"
fi
echo ""

# 4. בדיקת חיבור
print_info "4. בודק חיבור מקומי..."
if command -v curl &> /dev/null; then
    sleep 2
    RESPONSE=$(curl -k -s -o /dev/null -w "%{http_code}" "https://localhost:$HTTPS_PORT/health" 2>/dev/null)
    if [ "$RESPONSE" == "200" ]; then
        print_success "השרת מגיב מקומית ✅"
    else
        print_error "השרת לא מגיב (HTTP $RESPONSE)"
    fi
else
    print_warning "curl לא מותקן - לא ניתן לבדוק"
fi
echo ""

# 5. הצגת כתובות
LOCAL_IP=$(hostname -I | awk '{print $1}')
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "לא נמצא")

print_info "5. כתובות גישה:"
echo ""
echo "   מקומי:  https://localhost:$HTTPS_PORT"
echo "   רשת:    https://$LOCAL_IP:$HTTPS_PORT"
if [ "$PUBLIC_IP" != "לא נמצא" ]; then
    echo "   ציבורי: https://$PUBLIC_IP:$HTTPS_PORT"
fi
echo ""

# 6. הוראות נוספות
print_warning "אם עדיין לא נגיש מבחוץ:"
echo ""
echo "1. בדוק את הגדרות ה-VPS provider שלך:"
echo "   - Security Groups (AWS)"
echo "   - Firewall Rules (DigitalOcean)"
echo "   - Network Rules (Google Cloud, Azure)"
echo ""
echo "2. ודא שהפורט $HTTPS_PORT פתוח ב-VPS provider"
echo ""
echo "3. נסה לגשת מה-VPS עצמו:"
echo "   curl -k https://$LOCAL_IP:$HTTPS_PORT/health"
echo ""
echo "4. בדוק את הלוגים:"
echo "   pm2 logs inventory-server"
echo ""

print_success "סיום!"
echo ""

