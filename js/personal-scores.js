// Personal scores page script (standalone)
function getLocalCurrentUser() {
    try {
        const raw = localStorage.getItem('currentUser');
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function setLocalCurrentUser(user) {
    try { localStorage.setItem('currentUser', JSON.stringify(user)); } catch(e){}
}

function getPersonalScoresLS(userId){
    try { const raw = localStorage.getItem(`personalScores_${userId}`); return raw?JSON.parse(raw):[]; } catch(e){return []}
}
function setPersonalScoresLS(userId, list){ try{ localStorage.setItem(`personalScores_${userId}`, JSON.stringify(list||[])); }catch(e){}
}

function renderScores(){
    const user = getLocalCurrentUser();
    const section = document.getElementById('scores-section');
    const owner = document.getElementById('owner-name');
    const tbody = document.querySelector('#scores-table tbody');
    tbody.innerHTML = '';
    if (!user || !user.id) {
        section.style.display = 'none';
        return;
    }
    const filterEl = document.getElementById('test-filter');
    const filter = filterEl ? filterEl.value : 'all';

    // Prefer remote list if loaded, otherwise fall back to localStorage
    const rawLocal = getPersonalScoresLS(user.id) || [];
    const rawRemote = window.__personalRemoteCache && window.__personalRemoteCache[user.id] ? window.__personalRemoteCache[user.id] : null;
    const sourceList = rawRemote && Array.isArray(rawRemote) && rawRemote.length ? rawRemote : rawLocal;

    const list = sourceList.filter(it => {
        if (!filter || filter === 'all') return true;
        return String(it.test) === String(filter);
    });
    owner.textContent = user.name || user.displayName || 'Unknown';
    section.style.display = '';
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-note">Chưa có điểm nào.</td></tr>';
        return;
    }
    list.forEach((it, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(it.date).toLocaleString()}</td>
            <td>${it.test || '-'}</td>
            <td>${(typeof it.totalPoint === 'number')?it.totalPoint: '-'}</td>
            <td>${(typeof it.readingPoint === 'number')?it.readingPoint : '-'}</td>
            <td>${(typeof it.listeningPoint === 'number')?it.listeningPoint : '-'}</td>
            <td><button class="delete-btn" data-idx="${idx}">Xóa</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function wire(){
    const loginSection = document.getElementById('login-section');
    const scoresSection = document.getElementById('scores-section');
    const userArea = document.getElementById('user-area');
    const loginBtn = document.getElementById('login-btn');
    const usernameInput = document.getElementById('username-input');
    const refreshBtn = document.getElementById('refresh-btn');
    const clearBtn = document.getElementById('clear-btn');

    function updateUI(){
        const user = getLocalCurrentUser();
        if (user && user.id) {
            loginSection.style.display = 'none';
            scoresSection.style.display = '';
            userArea.innerHTML = `<div>Đăng nhập: <strong>${user.name}</strong></div>`;
            // attempt to load remote scores then render
            loadRemoteScoresIfAvailable(user.id).then(() => renderScores()).catch(()=> renderScores());
        } else {
            loginSection.style.display = '';
            scoresSection.style.display = 'none';
            userArea.innerHTML = '';
        }
    }

    loginBtn.addEventListener('click', ()=>{
        const name = usernameInput.value && usernameInput.value.trim();
        if (!name) return alert('Vui lòng nhập tên.');
        const user = { id: 'local_'+(name.toLowerCase().replace(/\s+/g,'_')) , name };
        setLocalCurrentUser(user);
        updateUI();
    });

    refreshBtn.addEventListener('click', ()=> renderScores());
    const testFilter = document.getElementById('test-filter');
    if (testFilter) {
        testFilter.addEventListener('change', () => renderScores());
    }
    clearBtn.addEventListener('click', ()=>{
        if (!confirm('Xóa tất cả điểm cá nhân?')) return;
        const user = getLocalCurrentUser();
        if (!user || !user.id) return;
        setPersonalScoresLS(user.id, []);
        renderScores();
    });

    document.querySelector('#scores-table tbody').addEventListener('click', async (e)=>{
        const d = e.target.closest('.delete-btn');
        if (!d) return;
        const idx = Number(d.dataset.idx);
        const user = getLocalCurrentUser();
        if (!user || !user.id) return;

        const rawRemote = window.__personalRemoteCache && window.__personalRemoteCache[user.id] ? window.__personalRemoteCache[user.id] : null;
        const rawLocal = getPersonalScoresLS(user.id) || [];
        const sourceList = rawRemote && Array.isArray(rawRemote) && rawRemote.length ? rawRemote : rawLocal;

        const entry = sourceList[idx];
        if (!entry) return;

        // If remote entry with key and firebase available, remove from Firebase
        if (entry && entry.key && typeof window.deletePersonalScoreRemote === 'function') {
            if (!confirm('Xác nhận xóa bản ghi trên server?')) return;
            try {
                await window.deletePersonalScoreRemote(user.id, entry.key);
            } catch (err) {
                console.warn('Failed to remove remote personal score', err);
            }
            // remove from cache
            if (rawRemote) rawRemote.splice(idx,1);
            renderScores();
            return;
        }

        // Otherwise remove from localStorage
        rawLocal.splice(idx,1);
        setPersonalScoresLS(user.id, rawLocal);
        renderScores();
    });

    updateUI();
}

// Try loading personal scores from Firebase under users/<userId>/personalScores
async function loadRemoteScoresIfAvailable(userId){
    if (!userId) return;
    try {
        if (typeof db === 'undefined' || !db) return;
        if (typeof get !== 'function' || typeof ref !== 'function') return;
        const snap = await get(ref(db, `users/${userId}/personalScores`));
        const items = [];S
        if (snap) {
            snap.forEach(child => {
                const v = child.val();
                if (v) items.push(Object.assign({ key: child.key }, v));
            });
        }
        window.__personalRemoteCache = window.__personalRemoteCache || {};
        // sort by date desc
        items.sort((a,b)=> new Date(b.date) - new Date(a.date));
        window.__personalRemoteCache[userId] = items;
    } catch (e) {
        console.warn('loadRemoteScoresIfAvailable failed', e);
    }
}

window.addEventListener('DOMContentLoaded', wire);
