const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const xlsx = require('xlsx');
const { open } = require('sqlite');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// ================= הגדרות נתיבים =================
const TEMP_DIR = os.tmpdir();
const UPLOAD_DIR = path.join(TEMP_DIR, 'uploads');
const DB_DIR = path.join(__dirname, 'db'); 
const DB_FILE = path.join(DB_DIR, 'database.sqlite');
const CERT_DIR = path.join(__dirname, 'certs');
const KEY_PATH = path.join(CERT_DIR, 'key.pem');
const CERT_PATH = path.join(CERT_DIR, 'cert.pem');

// ================= בדיקת אישורי SSL =================
if (!fs.existsSync(KEY_PATH) || !fs.existsSync(CERT_PATH)) {
    console.error('❌ אישורי SSL לא נמצאו!');
    console.log('📝 הרץ: node setup-https.js');
    console.log('   או: npm run setup:https\n');
    process.exit(1);
}

// ================= Middleware =================
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// הגשת קבצים סטטיים
app.use(express.static(path.join(__dirname, 'public')));

// נתיב בדיקה
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Server is running',
        protocol: 'https',
        timestamp: new Date().toISOString()
    });
});

// נתיב ראשי
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// יצירת תיקיות אם חסרות
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// הגדרת Multer להעלאת קבצים עם הגבלות אבטחה
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safeName}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('סוג קובץ לא נתמך. יש להעלות קובץ Excel (.xlsx, .xls) או CSV'));
        }
    }
}).single('excel');

function safeUnlink(filePath) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// ================= אתחול מסד נתונים =================
let db = null;

async function initDB() {
    try {
        db = await open({ filename: DB_FILE, driver: sqlite3.Database });

        await db.run(`
            CREATE TABLE IF NOT EXISTS CMDB (
                AssetID INTEGER PRIMARY KEY AUTOINCREMENT,
                AssetTag TEXT,
                SerialNumber TEXT,
                Name TEXT,
                Department TEXT,
                Location TEXT,
                StatusCMDB TEXT DEFAULT 'לא נבדק'
            )
        `);

        await db.run(`
            CREATE TABLE IF NOT EXISTS Scans (
                ScanID INTEGER PRIMARY KEY AUTOINCREMENT,
                AssetTag TEXT,
                SerialNumber TEXT,
                ScannerUser TEXT,
                ScanTime DATETIME DEFAULT CURRENT_TIMESTAMP,
                Status TEXT,
                Comments TEXT
            )
        `);

        await db.run(`
            CREATE TABLE IF NOT EXISTS Exceptions (
                ExceptionID INTEGER PRIMARY KEY AUTOINCREMENT,
                SearchCode TEXT,
                Details TEXT,
                ScannerUser TEXT,
                TimeAdded DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Database initialized ✅');
    } catch (e) {
        console.error('DB Init Error:', e);
    }
}

app.use('/api', async (req, res, next) => {
    if (!db) await initDB();
    next();
});

// ================= API Routes (העתק מ-server.js) =================
// כאן צריך להעתיק את כל ה-routes מ-server.js
// אני אעתיק את החשובים ביותר:

app.post('/api/upload-excel', (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, error: err.message });
        if (!req.file) return res.status(400).json({ success: false, error: 'לא הועבר קובץ' });

        const filePath = req.file.path;

        try {
            const stats = fs.statSync(filePath);
            if (stats.size > 10 * 1024 * 1024) {
                safeUnlink(filePath);
                return res.status(400).json({ success: false, error: 'קובץ גדול מדי (מקסימום 10MB)' });
            }

            const workbook = xlsx.readFile(filePath, {
                cellDates: false,
                cellStyles: false
            });
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                safeUnlink(filePath);
                return res.status(400).json({ success: false, error: 'קובץ Excel ריק או לא תקין' });
            }
            
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = xlsx.utils.sheet_to_json(sheet, { 
                defval: '',
                raw: false,
                dateNF: false
            });

            if (rows.length > 100000) {
                safeUnlink(filePath);
                return res.status(400).json({ success: false, error: 'יותר מדי שורות בקובץ (מקסימום 100,000)' });
            }

            await db.run('DELETE FROM CMDB'); 
            await db.exec('BEGIN TRANSACTION');

            const stmt = await db.prepare(`
                INSERT INTO CMDB (AssetTag, SerialNumber, Name, Department, Location, StatusCMDB)
                VALUES (?, ?, ?, ?, ?, 'לא נבדק')
            `);

            function sanitizeRow(row) {
                const sanitized = {};
                for (const key in row) {
                    if (typeof key === 'string' && !key.startsWith('__') && key !== 'constructor' && key !== 'prototype') {
                        const value = row[key];
                        sanitized[key] = typeof value === 'string' ? value.substring(0, 1000) : String(value || '').substring(0, 1000);
                    }
                }
                return sanitized;
            }

            let count = 0;
            for (const r of rows) {
                const sanitizedRow = sanitizeRow(r);
                const assetTag = (sanitizedRow['# מספר מנוע מהרה'] || '').toString().trim();
                const serial = (sanitizedRow['מספר סידורי'] || '').toString().trim();
                const name = (sanitizedRow['שם פריט המורה'] || '').toString().trim();
                const dept = (sanitizedRow['מחלקה קוד'] || '').toString().trim();
                const loc = (sanitizedRow['חדר'] || '').toString().trim();

                if (!assetTag && !serial && !name) continue;
                await stmt.run([assetTag, serial, name, dept, loc]);
                count++;
            }

            await stmt.finalize();
            await db.exec('COMMIT');
            safeUnlink(filePath);
            res.json({ success: true, count });

        } catch (e) {
            await db.exec('ROLLBACK');
            safeUnlink(filePath);
            console.error(e);
            res.status(500).json({ success: false, error: e.message });
        }
    });
});

app.get('/api/item/:number', async (req, res) => {
    try {
        const tag = req.params.number.trim();
        const items = await db.all(
            `SELECT * FROM CMDB WHERE AssetTag = ? OR SerialNumber = ?`,
            [tag, tag]
        );

        const mappedItems = items.map(item => ({
            item_name: item.Name,
            fixed_number: item.AssetTag, 
            imn: item.SerialNumber,      
            department: item.Department,
            room: item.Location,         
            original_status: item.StatusCMDB
        }));

        res.json({ success: true, items: mappedItems });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/submit-scan', async (req, res) => {
    const { number, imn, result, details, newData } = req.body;
    const assetTag = number || '';
    const serialNumber = imn || '';
    const scannerUser = 'User'; 

    try {
        if (newData) {
            await db.run(`
                INSERT INTO Exceptions (SearchCode, Details, ScannerUser)
                VALUES (?, ?, ?)`,
                [assetTag || serialNumber, newData.notes, scannerUser]
            );
            return res.json({ success: true, savedTo: 'exceptions' });
        }

        await db.run(`
            INSERT INTO Scans (AssetTag, SerialNumber, ScannerUser, Status, Comments)
            VALUES (?, ?, ?, ?, ?)`,
            [assetTag, serialNumber, scannerUser, result, details]
        );

        await db.run(`
            UPDATE CMDB SET StatusCMDB = ? 
            WHERE AssetTag = ? OR SerialNumber = ?`,
            [result, assetTag, serialNumber]
        );

        res.json({ success: true, savedTo: 'scans' });
    } catch (e) {
        console.error('Submit Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const total = await db.get('SELECT COUNT(*) as c FROM CMDB');
        const scannedGood = await db.get("SELECT COUNT(*) as c FROM Scans WHERE Status = 'good'");
        const scannedBad = await db.get("SELECT COUNT(*) as c FROM Scans WHERE Status = 'bad'");
        const scannedMissing = await db.get("SELECT COUNT(*) as c FROM Scans WHERE Status = 'missing'");
        const exceptions = await db.get('SELECT COUNT(*) as c FROM Exceptions');

        const totalScanned = (scannedGood?.c || 0) + (scannedBad?.c || 0) + (scannedMissing?.c || 0);

        res.json({
            total: total?.c || 0,
            scanned: totalScanned,
            good: scannedGood?.c || 0,
            bad: scannedBad?.c || 0,
            missing: scannedMissing?.c || 0,
            unreg: exceptions?.c || 0
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/list', async (req, res) => {
    const filter = req.query.filter || 'all';
    let rows = [];

    try {
        if (filter === 'not_scanned' || filter === 'all') {
            const data = await db.all(`SELECT * FROM CMDB WHERE StatusCMDB = 'לא נבדק'`);
            rows.push(...data.map(i => ({
                imn: i.SerialNumber,
                fixed_number: i.AssetTag,
                identifier: '',
                department: i.Department,
                room: i.Location,
                status: 'ממתין לסריקה',
                notes: ''
            })));
        }

        if (filter === 'good' || filter === 'bad' || filter === 'missing' || filter === 'all') {
            let sql = `SELECT * FROM Scans`;
            if (filter !== 'all') sql += ` WHERE Status = '${filter}'`;
            const data = await db.all(sql);
            rows.push(...data.map(i => ({
                imn: i.SerialNumber,
                fixed_number: i.AssetTag,
                identifier: i.ScannerUser,
                department: 'Scanned',
                room: '',
                status: i.Status,
                notes: i.Comments
            })));
        }

        if (filter === 'unreg' || filter === 'all') {
            const data = await db.all(`SELECT * FROM Exceptions`);
            rows.push(...data.map(i => ({
                imn: i.SearchCode,
                fixed_number: '',
                identifier: 'חריג',
                department: '',
                room: '',
                status: 'חריג',
                notes: i.Details
            })));
        }

        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'List Error' });
    }
});

app.get('/api/departments', async (req, res) => {
    try {
        const rows = await db.all('SELECT DISTINCT Department FROM CMDB WHERE Department IS NOT NULL');
        res.json(rows.map(r => r.Department));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ================= הפעלה עם HTTPS =================
async function startServer(port) {
    return new Promise((resolve, reject) => {
        const options = {
            key: fs.readFileSync(KEY_PATH),
            cert: fs.readFileSync(CERT_PATH)
        };

        const server = https.createServer(options, app).listen(port, '0.0.0.0', () => {
            const networkInterfaces = os.networkInterfaces();
            let localIP = 'localhost';
            
            for (const interfaceName in networkInterfaces) {
                const interfaces = networkInterfaces[interfaceName];
                for (const iface of interfaces) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        localIP = iface.address;
                        break;
                    }
                }
                if (localIP !== 'localhost') break;
            }
            
            console.log(`🚀 השרת HTTPS פעיל!`);
            console.log(`   מקומי: https://localhost:${port}`);
            console.log(`   רשת:   https://${localIP}:${port}`);
            console.log(`   API:    https://${localIP}:${port}/api`);
            console.log(`\n⚠️  הערה: זהו אישור self-signed.`);
            console.log(`   הדפדפן יציג אזהרת אבטחה - זה נורמלי.`);
            console.log(`   לחץ "מתקדם" > "המשך לאתר" כדי להתעלם מהאזהרה.\n`);
            initDB();
            resolve(server);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️  פורט ${port} תפוס, מנסה פורט ${port + 1}...`);
                resolve(null);
            } else {
                reject(err);
            }
        });
    });
}

async function startServerWithPortFallback() {
    let currentPort = HTTPS_PORT;
    const maxAttempts = 10;
    
    for (let i = 0; i < maxAttempts; i++) {
        const server = await startServer(currentPort);
        if (server) {
            return;
        }
        currentPort++;
    }
    
    console.error(`❌ לא ניתן למצוא פורט פנוי (ניסיתי ${HTTPS_PORT}-${currentPort - 1})`);
    process.exit(1);
}

startServerWithPortFallback();

