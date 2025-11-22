const fs = require('fs');
const path = require('path');
const https = require('https');
const selfsigned = require('selfsigned');
const os = require('os');

console.log('🔐 יצירת אישורי SSL...\n');

// מציאת כתובת IP מקומית
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName];
        for (const addr of addresses) {
            if (addr.family === 'IPv4' && !addr.internal) {
                return addr.address;
            }
        }
    }
    return 'localhost';
}

const localIP = getLocalIP();
const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'countryName', value: 'IL' },
    { name: 'organizationName', value: 'Inventory Management' }
];

const pems = selfsigned.generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [
        {
            name: 'basicConstraints',
            cA: true
        },
        {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
        },
        {
            name: 'subjectAltName',
            altNames: [
                {
                    type: 2, // DNS
                    value: 'localhost'
                },
                {
                    type: 2,
                    value: '127.0.0.1'
                },
                {
                    type: 7, // IP
                    ip: '127.0.0.1'
                },
                {
                    type: 7,
                    ip: localIP
                }
            ]
        }
    ]
});

// שמירת הקבצים
const certDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
}

const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

fs.writeFileSync(keyPath, pems.private);
fs.writeFileSync(certPath, pems.cert);

console.log('✅ אישורי SSL נוצרו בהצלחה!');
console.log(`📁 הקבצים נשמרו ב: ${certDir}`);
console.log(`   - key.pem (מפתח פרטי)`);
console.log(`   - cert.pem (אישור)`);
console.log(`\n🌐 כתובת IP מקומית: ${localIP}`);
console.log(`\n⚠️  הערה: זהו אישור self-signed.`);
console.log(`   הדפדפן יציג אזהרת אבטחה - זה נורמלי וניתן להתעלם ממנה.`);
console.log(`\n📝 הפעל את השרת עם: npm run start:https`);
console.log(`   או: node server-https.js\n`);

