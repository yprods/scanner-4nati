#!/bin/bash

# סקריפט להגדרת דומיין עם SSL אמיתי

DOMAIN="${1:-scanner.yprods.com}"
EMAIL="${2:-admin@yprods.com}"
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
echo "  הגדרת דומיין: $DOMAIN"
echo "=========================================="
echo ""

# בדיקת הרשאות
if [ "$EUID" -ne 0 ]; then 
    print_error "הסקריפט צריך הרשאות root"
    print_info "הרץ: sudo ./setup-domain.sh $DOMAIN $EMAIL"
    exit 1
fi

# בדיקת התקנת nginx
if ! command -v nginx &> /dev/null; then
    print_warning "nginx לא מותקן. מתקין..."
    apt-get update
    apt-get install -y nginx
    if [ $? -eq 0 ]; then
        print_success "nginx הותקן"
    else
        print_error "שגיאה בהתקנת nginx"
        exit 1
    fi
else
    print_success "nginx כבר מותקן"
fi

# בדיקת התקנת certbot
if ! command -v certbot &> /dev/null; then
    print_warning "certbot לא מותקן. מתקין..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
    if [ $? -eq 0 ]; then
        print_success "certbot הותקן"
    else
        print_error "שגיאה בהתקנת certbot"
        exit 1
    fi
else
    print_success "certbot כבר מותקן"
fi

# יצירת קובץ הגדרות nginx
print_info "יוצר קובץ הגדרות nginx..."

NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"
cat > "$NGINX_CONFIG" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # הגדרת גודל מקסימלי להעלאת קבצים
    client_max_body_size 10M;

    # Proxy לשרת Node.js
    location / {
        proxy_pass https://localhost:$HTTPS_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # הגדרות timeout
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

print_success "קובץ הגדרות nginx נוצר"

# הפעלת האתר
print_info "מפעיל את האתר..."
ln -sf "$NGINX_CONFIG" "/etc/nginx/sites-enabled/$DOMAIN"
rm -f /etc/nginx/sites-enabled/default 2>/dev/null

# בדיקת הגדרות nginx
print_info "בודק הגדרות nginx..."
nginx -t

if [ $? -ne 0 ]; then
    print_error "שגיאה בהגדרות nginx"
    exit 1
fi

# הפעלה מחדש של nginx
print_info "מפעיל מחדש את nginx..."
systemctl reload nginx

if [ $? -eq 0 ]; then
    print_success "nginx הופעל מחדש"
else
    print_error "שגיאה בהפעלת nginx"
    exit 1
fi

# יצירת אישור SSL
print_info "יוצר אישור SSL עם Let's Encrypt..."
print_warning "ודא ש-DNS מצביע ל-$DOMAIN לפני שתמשיך!"

read -p "האם DNS כבר מוגדר? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "הגדר DNS לפני שתמשיך:"
    print_info "  A record: $DOMAIN -> YOUR_VPS_IP"
    print_info "  או CNAME: $DOMAIN -> your-existing-domain.com"
    exit 0
fi

# יצירת אישור SSL
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect

if [ $? -eq 0 ]; then
    print_success "אישור SSL נוצר בהצלחה!"
else
    print_error "שגיאה ביצירת אישור SSL"
    print_info "נסה ידנית: certbot --nginx -d $DOMAIN"
    exit 1
fi

# עדכון הגדרות nginx ל-HTTPS
print_info "מעדכן הגדרות nginx ל-HTTPS..."
certbot --nginx -d "$DOMAIN" --non-interactive

# הפעלה מחדש של nginx
systemctl reload nginx

print_success "הכל הוגדר בהצלחה!"
echo ""
print_info "הדומיין שלך:"
echo "  http://$DOMAIN  (מתעדכן אוטומטית ל-HTTPS)"
echo "  https://$DOMAIN"
echo ""
print_info "האישור יתחדש אוטומטית כל 90 יום"
print_info "לבדיקה: certbot certificates"
echo ""

