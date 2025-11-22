const API_BASE_URL = window.location.origin + '/api';

let html5Qrcode = null;
let isScanning = false;
let currentItemData = null;

// הפעלה ראשונית בטעינת הדף
document.addEventListener('DOMContentLoaded', () => {
    startScanner();
    const toggleBtn = document.getElementById('toggleManualButton');
    if(toggleBtn) toggleBtn.addEventListener('click', toggleManualInput);
    document.querySelectorAll('input[name="status"]').forEach(radio => {
        radio.addEventListener('change', toggleComments);
    });
});

// הצגת הודעת טעינה
function showLoadingMessage(message) {
    const scannerSection = document.getElementById('scannerSection');
    if (scannerSection && !scannerSection.innerHTML.includes('מתחיל סורק')) {
        if (!originalScannerContent) {
            originalScannerContent = scannerSection.innerHTML;
        }
        scannerSection.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
                <p style="color: #666; font-size: 16px;">${message}</p>
                <p style="color: #999; font-size: 14px; margin-top: 10px;">
                    אם תופיע בקשה, אנא לחץ "אפשר"
                </p>
            </div>
        `;
    }
}

// הסתרת הודעת טעינה
function hideLoadingMessage() {
    const scannerSection = document.getElementById('scannerSection');
    if (scannerSection && scannerSection.innerHTML.includes('מתחיל סורק')) {
        restoreScannerContent();
    }
}

async function startScanner() {
    // אם הסורק כבר פעיל, לא ניצור חדש
    if (isScanning || html5Qrcode) return;

    const readerEl = document.getElementById('reader');
    if (!readerEl) return;

    // בדיקה אם הדפדפן תומך
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showPermissionError('הדפדפן לא תומך בגישה למצלמה. אנא השתמש בדפדפן מודרני.');
        return;
    }

    // בדיקה אם זה HTTPS או localhost (נדרש ב-iOS Safari)
    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    
    if (!isSecure && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
        showPermissionError('ב-iOS Safari נדרש HTTPS לגישה למצלמה. אנא השתמש ב-HTTPS או localhost.');
        return;
    }

    try {
        // יצירת אובייקט Html5Qrcode חדש
        html5Qrcode = new Html5Qrcode("reader");
        
        // הגדרה דינמית של גודל התיבה
        const readerWidth = readerEl.offsetWidth || 400;
        const qrBoxSize = Math.min(readerWidth * 0.8, 350);
        
        const config = {
            fps: 10,
            qrbox: { width: qrBoxSize, height: qrBoxSize },
            aspectRatio: 1.0,
            videoConstraints: {
                facingMode: "environment" // מצלמה אחורית
            },
            formatsToSupport: [
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.CODE_93,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.DATA_MATRIX,
                Html5QrcodeSupportedFormats.ITF
            ],
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true // שימוש ב-BarcodeDetector API אם זמין
            }
        };

        // הצגת הודעה שהסורק מתחיל
        showLoadingMessage('מתחיל סורק...');

        // התחלת סריקה - זה יבקש הרשאה אוטומטית
        await html5Qrcode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanError
        );
        
        isScanning = true;
        console.log('סורק ברקודים הופעל בהצלחה');
        
        // הסתרת הודעות
        hideLoadingMessage();
        hidePermissionError();
        
    } catch (err) {
        console.error('שגיאה בהפעלת הסורק:', err);
        hideLoadingMessage();
        
        // בדיקה אם זו שגיאת הרשאה
        const errorMessage = err.message || err.toString();
        const isPermissionError = err.name === 'NotAllowedError' || 
                                  err.name === 'PermissionDeniedError' ||
                                  errorMessage.includes('permission') || 
                                  errorMessage.includes('Permission') ||
                                  errorMessage.includes('denied') ||
                                  errorMessage.includes('NotAllowed');
        
        if (isPermissionError) {
            let message = 'הרשאה למצלמה נדחתה. ';
            if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
                message += 'ב-iPhone: הגדרות > Safari > מצלמה > אפשר';
            } else {
                message += 'אנא אפשר גישה למצלמה בהגדרות הדפדפן.';
            }
            showPermissionError(message);
        } else if (errorMessage.includes('NotFound') || errorMessage.includes('no camera')) {
            showPermissionError('לא נמצאה מצלמה במכשיר.');
        } else {
            showPermissionError('שגיאה בהפעלת המצלמה: ' + errorMessage);
        }
        html5Qrcode = null;
    }
}

// שמירת תוכן מקורי של scannerSection
let originalScannerContent = null;

// הצגת הודעת שגיאת הרשאה
function showPermissionError(message) {
    const scannerSection = document.getElementById('scannerSection');
    if (scannerSection) {
        // שמירת התוכן המקורי אם עדיין לא נשמר
        if (!originalScannerContent) {
            originalScannerContent = scannerSection.innerHTML;
        }
        
        scannerSection.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">📷</div>
                <h3 style="color: #d32f2f; margin-bottom: 10px;">אין גישה למצלמה</h3>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">${message}</p>
                <button id="retryPermissionBtn" style="padding: 12px 24px; background-color: #6366f1; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-bottom: 10px;">
                    נסה שוב
                </button>
                <div style="margin-top: 20px; padding: 15px; background-color: #f0f0f0; border-radius: 8px; text-align: right;">
                    <p style="font-size: 14px; color: #333; margin-bottom: 10px; font-weight: bold;">
                        הוראות ל-iPhone Safari:
                    </p>
                    <ol style="font-size: 13px; color: #666; line-height: 1.8; text-align: right; padding-right: 20px;">
                        <li>פתח את אפליקציית הגדרות</li>
                        <li>גלול למטה ולחץ על "Safari"</li>
                        <li>גלול למטה ולחץ על "מצלמה"</li>
                        <li>בחר "אפשר"</li>
                        <li>חזור לאפליקציה ולחץ "נסה שוב"</li>
                    </ol>
                </div>
                <p style="margin-top: 15px; font-size: 12px; color: #999;">
                    <strong>הערה:</strong> ב-iOS Safari נדרש HTTPS או localhost לגישה למצלמה
                </p>
            </div>
        `;
        
        // הוספת event listener לכפתור
        const retryBtn = document.getElementById('retryPermissionBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                restoreScannerContent();
                startScanner();
            });
        }
    }
}

// שחזור תוכן מקורי
function restoreScannerContent() {
    const scannerSection = document.getElementById('scannerSection');
    if (scannerSection && originalScannerContent) {
        scannerSection.innerHTML = originalScannerContent;
        // הוספת event listeners מחדש
        const toggleBtn = document.getElementById('toggleManualButton');
        if(toggleBtn) toggleBtn.addEventListener('click', toggleManualInput);
    }
}

// הסתרת הודעת שגיאה
function hidePermissionError() {
    restoreScannerContent();
}

function onScanSuccess(decodedText, decodedResult) {
    console.log('ברקוד/QR נסרק:', decodedText);
    
    // עצירת הסורק
    stopScanner();
    
    // הסתרת הסורק והצגת כפתור חזרה
    document.getElementById('scannerSection').classList.add('hidden');
    document.getElementById('restartScanBtn').classList.remove('hidden');
    document.getElementById('toggleManualButton').classList.add('hidden');

    // בדיקת הקוד בשרת
    checkCodeInServer(decodedText);
}

function onScanError(errorMessage) {
    // התעלמות משגיאות סריקה שוטפות (לא מציגים כל שגיאה)
    // console.log('שגיאת סריקה:', errorMessage);
}

async function stopScanner() {
    if (html5Qrcode && isScanning) {
        try {
            await html5Qrcode.stop();
            await html5Qrcode.clear();
            html5Qrcode = null;
            isScanning = false;
        } catch (err) {
            console.error('שגיאה בעצירת הסורק:', err);
            html5Qrcode = null;
            isScanning = false;
        }
    }
}

async function toggleManualInput() {
    const section = document.getElementById('manualInputSection');
    const btn = document.getElementById('toggleManualButton');
    const scannerSection = document.getElementById('scannerSection');

    if (section.classList.contains('hidden')) {
        // פתיחת הזנה ידנית
        section.classList.remove('hidden');
        btn.classList.add('hidden');
        scannerSection.classList.add('hidden');
        
        // עצירת הסורק
        await stopScanner();
    } else {
        // סגירת הזנה ידנית וחזרה למצלמה
        section.classList.add('hidden');
        btn.classList.remove('hidden');
        scannerSection.classList.remove('hidden'); 
        startScanner();
    }
}

function handleManualSearch() {
    const code = document.getElementById('manualCodeInput').value;
    if (code && code.length > 1) {
        document.getElementById('manualInputSection').classList.add('hidden');
        document.getElementById('scannerSection').classList.add('hidden');
        document.getElementById('restartScanBtn').classList.remove('hidden');
        
        checkCodeInServer(code);
    } else {
        alert('נא להזין קוד תקין');
    }
}

async function checkCodeInServer(code) {
    showLoading('בודק נתונים...');
    try {
        const cleanCode = code.trim();
        const res = await fetch(`${API_BASE_URL}/item/${cleanCode}`);
        const data = await res.json();
        hideLoading();

        if (data.success && data.items && data.items.length > 0) {
            currentItemData = data.items[0];
            showAssetInfo(currentItemData);
        } else {
            currentItemData = { searchCode: cleanCode };
            showExceptionForm(cleanCode);
        }
    } catch (e) {
        hideLoading();
        alert('שגיאת תקשורת: ' + e.message);
        resetAppState();
    }
}

function showAssetInfo(item) {
    const infoDiv = document.getElementById('assetInfo');
    const detailsDiv = document.getElementById('assetDetailsText');

    if (infoDiv && detailsDiv) {
        infoDiv.classList.remove('hidden');
        
        detailsDiv.innerHTML = `
            <p><strong>שם פריט:</strong> ${item.item_name || '-'}</p>
            <p><strong>מספר קבוע:</strong> ${item.fixed_number || '-'}</p>
            <p><strong>IMN/סידורי:</strong> ${item.imn || '-'}</p>
            <p><strong>מחלקה:</strong> ${item.department || '-'}</p>
            <p><strong>מיקום:</strong> ${item.room || '-'}</p>
        `;
    }
}

function showExceptionForm(code) {
    const form = document.getElementById('exceptionForm');
    if (form) {
        form.classList.remove('hidden');
        document.getElementById('exceptionCodeDisplay').textContent = code;
    }
}

function toggleComments() {
    const statusRadio = document.querySelector('input[name="status"]:checked');
    const commentsBox = document.getElementById('comments');

    if (statusRadio && commentsBox) {
        if (statusRadio.value === 'bad' || statusRadio.value === 'missing') {
            commentsBox.classList.remove('hidden');
        } else {
            commentsBox.classList.add('hidden');
        }
    }
}

async function submitScan() {
    const statusRadio = document.querySelector('input[name="status"]:checked');
    const comments = document.getElementById('comments').value;

    if (!statusRadio) {
        alert('יש לבחור סטטוס');
        return;
    }

    if ((statusRadio.value === 'bad' || statusRadio.value === 'missing') && !comments.trim()) {
        alert('חובה למלא הערות בסטטוס לא תקין/חסר');
        return;
    }

    const payload = {
        number: currentItemData.fixed_number,
        imn: currentItemData.imn,
        result: statusRadio.value,
        details: comments || '',
        newData: null
    };

    await sendToServer(payload);
}

async function submitException() {
    const notes = document.getElementById('exceptionNotes').value;
    if (!notes.trim()) {
        alert('חובה למלא תיאור לחריג');
        return;
    }

    const payload = {
        number: currentItemData.searchCode,
        imn: null,
        result: 'bad',
        details: notes,
        newData: { notes: notes }
    };

    await sendToServer(payload);
}

async function sendToServer(payload) {
    showLoading('שולח נתונים...');
    try {
        const res = await fetch(`${API_BASE_URL}/submit-scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            alert('נשמר בהצלחה! ✅');
            resetAppState();
        } else {
            alert('שגיאה בשמירה: ' + data.error);
        }
    } catch (e) {
        alert('שגיאת שרת: ' + e.message);
    } finally {
        hideLoading();
    }
}

async function resetAppState() {
    // איפוס תצוגה
    const elementsToHide = ['assetInfo', 'exceptionForm', 'manualInputSection'];
    elementsToHide.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    document.getElementById('scannerSection').classList.remove('hidden');
    document.getElementById('toggleManualButton').classList.remove('hidden');
    document.getElementById('restartScanBtn').classList.add('hidden');

    // איפוס שדות
    document.getElementById('manualCodeInput').value = '';
    document.getElementById('comments').value = '';
    document.getElementById('exceptionNotes').value = '';

    // איפוס רדיו
    const radios = document.getElementsByName('status');
    if(radios.length > 0) radios[0].checked = true;

    const commentsBox = document.getElementById('comments');
    if(commentsBox) commentsBox.classList.add('hidden');

    currentItemData = null;

    // עצירת סורק קיים והתחלת סורק מחדש
    await stopScanner();
    setTimeout(() => {
        startScanner();
    }, 300);
}

function showLoading(txt) {
    const el = document.getElementById('serverMessage');
    if(el) el.textContent = txt;
}

function hideLoading() {
    const el = document.getElementById('serverMessage');
    if(el) el.textContent = '';
}
