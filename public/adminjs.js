// ================= הגדרות בסיסיות =================
// לשימוש מקומי: 'http://localhost:3000/api'
// לשימוש בשרת פתוח: 'https://YOUR-SERVER-DOMAIN.com/api'
const API_BASE_URL = window.location.origin + '/api';

document.addEventListener('DOMContentLoaded', () => {
    // ================= Elements =================
    const excelFile = document.getElementById('excelFile');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadRes = document.getElementById('uploadRes');

    const statTotal = document.getElementById('statTotal');
    const statScanned = document.getElementById('statScanned');
    const statGood = document.getElementById('statGood');
    const statBad = document.getElementById('statBad');
    const statUnreg = document.getElementById('statUnreg');

    const deptSelect = document.getElementById('deptSelect');
    const filterSelect = document.getElementById('filterSelect');
    const refreshList = document.getElementById('refreshList');
    const listContainer = document.getElementById('listContainer');

    // ================= Utils =================
    function showMessage(container, text, type='info') {
        container.textContent = text;
        container.className = `msg ${type}`;
        setTimeout(() => { container.textContent=''; container.className='msg info'; }, 3000);
    }

    /**
     * פונקציית fetch שמנסה שוב אם נתקלת בשגיאת 503 (שירות לא זמין - DB עדיין מתאחל).
     */
    async function fetchWithRetry(endpoint, retries = 5, delay = 500) {
        const url = API_BASE_URL + endpoint;
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    return res;
                }

                // אם קיבלנו 503, ננסה שוב (מתאים ל-Cold Start)
                if (res.status === 503) {
                    console.warn(`[Retry ${i + 1}/${retries}] Server not ready (503). Retrying ${url}...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // לכל שגיאה אחרת, זרוק שגיאה
                const errorData = await res.json().catch(() => ({ error: 'שגיאת שרת לא ידועה' }));
                throw new Error(errorData.error || `Server returned status ${res.status}`);

            } catch (error) {
                if (i === retries - 1) {
                    throw error;
                }
                console.warn(`[Retry ${i + 1}/${retries}] Network error. Retrying ${url}...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw new Error('Max retries exceeded');
    }

    // ================= Upload Excel =================
    if(uploadBtn && excelFile){
        uploadBtn.addEventListener('click', async () => {
            if(!excelFile.files[0]){
                showMessage(uploadRes, '❌ יש לבחור קובץ', 'error');
                return;
            }
            const formData = new FormData();
            formData.append('excel', excelFile.files[0]);

            uploadBtn.disabled = true;
            showMessage(uploadRes, 'מעלה ומעבד... זמן טעינה תלוי בגודל הקובץ.', 'info');

            try{
                const res = await fetch(API_BASE_URL + '/upload-excel', { method:'POST', body: formData });
                const data = await res.json();

                if(res.ok && data.success){
                    showMessage(uploadRes, `✅ הועלו ${data.count} שורות בהצלחה. המערכת מוכנה!`, 'success');
                    excelFile.value='';
                    loadStats();
                    loadDepartments();
                    loadList();
                } else {
                    showMessage(uploadRes, `❌ שגיאה: ${data.error || 'שגיאת שרת לא ידועה'}`, 'error');
                }
            } catch(err){
                showMessage(uploadRes, `❌ שגיאה בשרת: ${err.message}`, 'error');
            } finally {
                uploadBtn.disabled = false;
            }
        });
    }

    // ================= Load Stats =================
    async function loadStats(){
        try{
            const res = await fetchWithRetry('/stats');
            const data = await res.json();
            statTotal.textContent = data.total || 0;
            statScanned.textContent = data.scanned || 0;
            statGood.textContent = data.good || 0;
            statBad.textContent = data.bad || 0;
            statUnreg.textContent = data.unreg || 0;
        } catch(err){
            console.error('Stats error: Failed to load stats after retries.', err);
            if(statTotal) statTotal.textContent = '❌';
        }
    }

    // ================= Load Departments =================
    async function loadDepartments(){
        if(!deptSelect) return;
        try{
            const res = await fetchWithRetry('/departments');
            const data = await res.json();
            const currentDept = deptSelect.value;

            deptSelect.innerHTML = '<option value="">-- כל המחלקות --</option>';
            data.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                deptSelect.appendChild(opt);
            });

            if(currentDept && data.includes(currentDept)) deptSelect.value = currentDept;

        } catch(err){
            console.error('Departments error: Failed to load departments after retries.', err);
        }
    }

    // ================= Load List =================
    async function loadList(){
        if(!listContainer) return;
        const dept = deptSelect ? deptSelect.value : '';
        const filter = filterSelect ? filterSelect.value : 'not_scanned'; // ברירת מחדל: נותר לסרוק
        listContainer.innerHTML = 'טוען...';
        try{
            const endpoint = `/list?dept=${encodeURIComponent(dept)}&filter=${encodeURIComponent(filter)}`;
            const res = await fetchWithRetry(endpoint);
            const data = await res.json();

            if(!Array.isArray(data) || data.length===0){
                listContainer.innerHTML = `<p>אין נתונים להצגה עבור סינון: <strong>${filter}</strong> ומחלקה: <strong>${dept || 'כל המחלקות'}</strong></p>`;
                return;
            }
            let html = `<table>
                <thead>
                    <tr>
                        <th>IMN</th>
                        <th>מספר/טבוע</th>
                        <th>מזהה</th>
                        <th>מחלקה</th>
                        <th>חדר</th>
                        <th>סטטוס</th>
                        <th>הערות</th>
                    </tr>
                </thead>
                <tbody>`;
            data.forEach(r => {
                html += `<tr>
                    <td>${r.imn||'N/A'}</td>
                    <td>${r.fixed_number||'N/A'}</td>
                    <td>${r.identifier||'N/A'}</td>
                    <td>${r.department||'N/A'}</td>
                    <td>${r.room||'N/A'}</td>
                    <td class="${r.status.includes('תקין') ? 'success' : r.status.includes('לא תקין') ? 'error' : 'info'}" style="font-weight:bold">${r.status||'N/A'}</td>
                    <td>${r.notes||''}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            listContainer.innerHTML = html;
        } catch(err){
            console.error('List error: Failed to load list after retries.', err);
            listContainer.innerHTML = `<p class="msg error">❌ שגיאה בטעינת הרשימה: ${err.message}. (נסו שוב)</p>`;
        }
    }

    // ================= Event Listeners =================
    if(refreshList){
        refreshList.addEventListener('click', ()=> loadList());
    }
    if(deptSelect){
        deptSelect.addEventListener('change', ()=> loadList());
    }
    if(filterSelect){
        filterSelect.addEventListener('change', ()=> loadList());
    }

    // ================= Initial Load =================
    loadStats();
    loadDepartments();
    loadList();
});
