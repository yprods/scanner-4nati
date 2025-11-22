#!/bin/bash

# סקריפט לבדיקת נגישות השרת

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
echo "  בדיקת נגישות שרת"
echo "=========================================="
echo ""

# בדיקה 1: האם השרת רץ
print_info "1. בודק אם השרת רץ..."
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "inventory-server"; then
        STATUS=$(pm2 jlist | grep -A 5 "inventory-server" | grep "pm2_env" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        if [ "$STATUS" == "online" ]; then
            print_success "השרת רץ ב-PM2 (status: $STATUS)"
        else
            print_error "השרת לא רץ ב-PM2 (status: $STATUS)"
            echo "   הרץ: pm2 restart inventory-server"
        fi
    else
        print_error "השרת לא נמצא ב-PM2"
        echo "   הרץ: pm2 start server-https.js --name inventory-server"
    fi
else
    print_warning "PM2 לא מותקן - בודק תהליכים אחרים..."
    if pgrep -f "server-https.js" > /dev/null; then
        print_success "השרת רץ (תהליך נמצא)"
    else
        print_error "השרת לא רץ"
    fi
fi
echo ""

# בדיקה 2: האם השרת מאזין על הפורט
print_info "2. בודק אם השרת מאזין על פורט $HTTPS_PORT..."
if command -v netstat &> /dev/null; then
    if netstat -tuln | grep -q ":$HTTPS_PORT "; then
        print_success "השרת מאזין על פורט $HTTPS_PORT"
        LISTENING=$(netstat -tuln | grep ":$HTTPS_PORT " | awk '{print $4}')
        echo "   מאזין על: $LISTENING"
    else
        print_error "השרת לא מאזין על פורט $HTTPS_PORT"
    fi
elif command -v ss &> /dev/null; then
    if ss -tuln | grep -q ":$HTTPS_PORT "; then
        print_success "השרת מאזין על פורט $HTTPS_PORT"
        LISTENING=$(ss -tuln | grep ":$HTTPS_PORT " | awk '{print $5}')
        echo "   מאזין על: $LISTENING"
    else
        print_error "השרת לא מאזין על פורט $HTTPS_PORT"
    fi
else
    print_warning "לא ניתן לבדוק (netstat/ss לא מותקן)"
fi
echo ""

# בדיקה 3: Firewall
print_info "3. בודק הגדרות Firewall..."
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status | head -1)
    if echo "$UFW_STATUS" | grep -q "active"; then
        print_warning "UFW פעיל"
        if sudo ufw status | grep -q "$HTTPS_PORT"; then
            print_success "פורט $HTTPS_PORT פתוח ב-UFW"
        else
            print_error "פורט $HTTPS_PORT לא פתוח ב-UFW"
            echo "   פתח עם: sudo ufw allow $HTTPS_PORT/tcp"
        fi
    else
        print_info "UFW לא פעיל"
    fi
elif command -v firewall-cmd &> /dev/null; then
    if sudo firewall-cmd --list-ports | grep -q "$HTTPS_PORT"; then
        print_success "פורט $HTTPS_PORT פתוח ב-firewalld"
    else
        print_error "פורט $HTTPS_PORT לא פתוח ב-firewalld"
        echo "   פתח עם: sudo firewall-cmd --permanent --add-port=$HTTPS_PORT/tcp && sudo firewall-cmd --reload"
    fi
else
    print_warning "לא נמצא firewall manager"
fi
echo ""

# בדיקה 4: כתובת IP
print_info "4. כתובות IP:"
LOCAL_IP=$(hostname -I | awk '{print $1}')
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "לא נמצא")

echo "   מקומי:  $LOCAL_IP"
echo "   ציבורי: $PUBLIC_IP"
echo ""
echo "   כתובות גישה:"
echo "   - https://localhost:$HTTPS_PORT"
echo "   - https://$LOCAL_IP:$HTTPS_PORT"
if [ "$PUBLIC_IP" != "לא נמצא" ]; then
    echo "   - https://$PUBLIC_IP:$HTTPS_PORT"
fi
echo ""

# בדיקה 5: בדיקת חיבור מקומי
print_info "5. בודק חיבור מקומי..."
if command -v curl &> /dev/null; then
    RESPONSE=$(curl -k -s -o /dev/null -w "%{http_code}" "https://localhost:$HTTPS_PORT/health" 2>/dev/null)
    if [ "$RESPONSE" == "200" ]; then
        print_success "השרת מגיב מקומית (HTTP $RESPONSE)"
    else
        print_error "השרת לא מגיב מקומית (HTTP $RESPONSE)"
    fi
else
    print_warning "curl לא מותקן - לא ניתן לבדוק חיבור"
fi
echo ""

# בדיקה 6: אישורי SSL
print_info "6. בודק אישורי SSL..."
if [ -f "certs/key.pem" ] && [ -f "certs/cert.pem" ]; then
    print_success "אישורי SSL קיימים"
else
    print_error "אישורי SSL לא נמצאו"
    echo "   יצירה עם: npm run setup:https"
fi
echo ""

# סיכום והמלצות
echo "=========================================="
echo "  המלצות לפתרון בעיות"
echo "=========================================="
echo ""

print_info "אם השרת לא נגיש מבחוץ:"
echo ""
echo "1. פתח את הפורט ב-Firewall:"
echo "   UFW:      sudo ufw allow $HTTPS_PORT/tcp"
echo "   Firewalld: sudo firewall-cmd --permanent --add-port=$HTTPS_PORT/tcp && sudo firewall-cmd --reload"
echo ""
echo "2. ודא שהשרת מאזין על 0.0.0.0 (לא רק localhost)"
echo "   בדוק ב-server-https.js שורה 381:"
echo "   .listen(port, '0.0.0.0', ...)"
echo ""
echo "3. בדוק את הגדרות ה-VPS provider:"
echo "   - Security Groups (AWS)"
echo "   - Firewall Rules (DigitalOcean, Azure)"
echo "   - Network Rules (Google Cloud)"
echo ""
echo "4. בדוק מה-VPS provider שלך אם יש firewall נוסף"
echo ""
echo "5. נסה לגשת מ-VPS עצמו:"
echo "   curl -k https://localhost:$HTTPS_PORT/health"
echo "   curl -k https://$LOCAL_IP:$HTTPS_PORT/health"
echo ""

