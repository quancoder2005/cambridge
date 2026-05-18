import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, get, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
import answersBank from "../data/answers.js";
import writingSamples from "../data/writing-samples.js";

// Small on-page debug banner to help track init / render progress without console
function updateDebug(msg) {
    try {
        let el = document.getElementById('app-debug-status');
        if (!el) {
            el = document.createElement('div');
            el.id = 'app-debug-status';
            el.style.position = 'fixed';
            el.style.right = '8px';
            el.style.bottom = '8px';
            el.style.zIndex = 9999;
            el.style.background = 'rgba(0,0,0,0.75)';
            el.style.color = '#fff';
            el.style.padding = '6px 8px';
            el.style.borderRadius = '6px';
            el.style.fontSize = '11px';
            el.style.maxWidth = '220px';
            el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
            document.body.appendChild(el);
        }
        el.textContent = String(msg || '');
    } catch (e) {
        // ignore
    }
}

// Helper to delete a personal score entry on Firebase
window.deletePersonalScoreRemote = async function(userId, key) {
    if (!db) throw new Error('Firebase not initialized');
    if (!userId || !key) throw new Error('Missing userId or key');
    try {
        await remove(ref(db, `users/${userId}/personalScores/${key}`));
        return true;
    } catch (e) {
        console.error('deletePersonalScoreRemote failed', e);
        throw e;
    }
}

function setMobileMenuOpen(isOpen) {
    const header = document.querySelector('header');
    const toggle = document.getElementById('mobile-menu-toggle');
    if (!header || !toggle) return;

    header.classList.toggle('menu-open', Boolean(isOpen));
    toggle.setAttribute('aria-expanded', Boolean(isOpen) ? 'true' : 'false');
    toggle.setAttribute('aria-label', Boolean(isOpen) ? 'Đóng menu' : 'Mở menu');
}

window.toggleMobileMenu = function(forceOpen) {
    const header = document.querySelector('header');
    if (!header) return;

    const nextState = typeof forceOpen === 'boolean' ? forceOpen : !header.classList.contains('menu-open');
    setMobileMenuOpen(nextState);
}

function closeMobileMenu() {
    setMobileMenuOpen(false);
}

// export const firebaseConfig = {
//   apiKey: "AIzaSyClJnAmEMIxsomf7dbhZ1eT89IfOsBZbto",
//   authDomain: "english-9fbd1.firebaseapp.com",
//   databaseURL: "https://english-9fbd1-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "english-9fbd1",
//   storageBucket: "english-9fbd1.firebasestorage.app",
//   messagingSenderId: "840464671403",
//   appId: "1:840464671403:web:57f8888959c2b8ae5b8dee",
//   measurementId: "G-YLRRP7CM9R"
// };

let db = null;
try {
    if (firebaseConfig && firebaseConfig.apiKey) {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
    } else {
        console.warn("Firebase chưa cấu hình. Tạm tắt bảng xếp hạng/lưu điểm.");
    }
} catch (error) {
    console.error("Không thể khởi tạo Firebase:", error);
}

const TOTAL_TESTS = 14;
const SECTIONS = ["reading", "listening", "writing","speaking"];
const ANSWER_SECTION_ORDER = ["reading", "listening", "writing"];
const AVAILABLE_TEST_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const EXAM_DURATION_SECONDS = 120 * 60;

const READING_SCHEMA = [
    { part: "Part 1", key: "part1", from: 1, to: 5, choices: ["A", "B", "C"] },
    { part: "Part 2", key: "part2", from: 6, to: 10, choices: ["A", "B", "C", "D", "E", "F", "G", "H"] },
    { part: "Part 3", key: "part3", from: 11, to: 15, choices: ["A", "B", "C", "D"] },
    { part: "Part 4", key: "part4", from: 16, to: 20, choices: ["A", "B", "C", "D", "E", "F", "G", "H"] },
    { part: "Part 5", key: "part5", from: 21, to: 26, choices: ["A", "B", "C", "D"] },
    { part: "Part 6", key: "part6", from: 27, to: 32, inputType: "text" },
];

const LISTENING_SCHEMA = [
    { part: "Part 1", key: "part1", from: 1, to: 7, choices: ["A", "B", "C"] },
    { part: "Part 2", key: "part2", from: 8, to: 13, choices: ["A", "B", "C"] },
    { part: "Part 3", key: "part3", from: 14, to: 19, inputType: "text" },
    { part: "Part 4", key: "part4", from: 20, to: 25, choices: ["A", "B", "C"] },
];

let currentScore = 0;
let answersData = null;
let latestResult = null;
let currentSectionOrder = [...ANSWER_SECTION_ORDER];
let currentExamPlan = buildUniformExamPlan(1);
const isShufflePage = location.pathname.toLowerCase().endsWith('shuffle.html');
let remainingSeconds = EXAM_DURATION_SECONDS;
let timerIntervalId = null;
let hasExamStarted = false;
let hasAutoSubmitted = false;
let activeListeningAudio = null;
let activeListeningAudioButton = null;
let activeListeningRequestId = 0;

function getCurrentUser() {
    try {
        const raw = localStorage.getItem("currentUser");
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        return parsed;
    } catch {
        return null;
    }
}

// Personal scores stored in localStorage under `personalScores_<userId>`
function getPersonalScores(userId) {
    try {
        const raw = localStorage.getItem(`personalScores_${userId}`);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function setPersonalScores(userId, scores) {
    try {
        localStorage.setItem(`personalScores_${userId}`, JSON.stringify(scores || []));
    } catch (e) {}
}

function savePersonalScore(result) {
    const user = getCurrentUser();
    if (!user || !user.id) return false;
    const list = getPersonalScores(user.id);
    const entry = {
        date: new Date().toISOString(),
        test: document.getElementById('test-selector') ? document.getElementById('test-selector').value : null,
        totalPoint: result?.totalPoint ?? currentScore,
        readingPoint: result?.readingPoint ?? null,
        listeningPoint: result?.listeningPoint ?? null,
        raw: result || null
    };
    list.unshift(entry);
    // keep last 200
    setPersonalScores(user.id, list.slice(0, 200));

    // Also attempt to save to Firebase under users/<userId>/personalScores
    try {
        if (typeof db !== 'undefined' && db && user.id) {
            const personalRef = push(ref(db, `users/${user.id}/personalScores`));
            const key = personalRef.key;
            const payload = Object.assign({ name: getLoggedInUserName(), userId: user.id }, entry);
            if (key) {
                update(ref(db), { [`users/${user.id}/personalScores/${key}`]: payload });
            }
        }
    } catch (e) {
        console.warn('Saving personal score to Firebase failed', e);
    }

    return true;
}

function getLoggedInUserName() {
    const currentUser = getCurrentUser();
    const name = currentUser?.name;
    return typeof name === "string" ? name.trim() : "";
}

function hasAuthenticatedUser() {
    const currentUser = getCurrentUser();
    return Boolean(currentUser?.id && getLoggedInUserName());
}

function syncUserNameInput() {
    const input = document.getElementById('userName');
    if (!input) return;
    const loggedInName = getLoggedInUserName();
    if (loggedInName) {
        input.value = loggedInName;
        input.readOnly = true;
        input.placeholder = "Tên đăng nhập";
    } else {
        input.readOnly = false;
        if (!input.value) input.placeholder = "Nhập tên của bạn...";
    }
}

function redirectToLogin() {
    window.location.href = "login.html";
}

function requireLoggedInExamAccess() {
    if (hasAuthenticatedUser()) {
        return true;
    }

    redirectToLogin();
    return false;
}

function syncAuthActionButton() {
    const authButton = document.getElementById("auth-action-btn");
    if (!authButton) return;

    const currentUser = getCurrentUser();
    const loggedInName = getLoggedInUserName();
    if (currentUser?.id && loggedInName) {
        authButton.textContent = `Đăng xuất (${loggedInName})`;
        authButton.classList.add("logout");
    } else {
        authButton.textContent = "Đăng nhập";
        authButton.classList.remove("logout");
    }
}

window.handleAuthAction = function() {
    const currentUser = getCurrentUser();
    const loggedInName = getLoggedInUserName();

    if (currentUser?.id && loggedInName) {
        localStorage.removeItem("currentUser");
    }

    window.location.href = "login.html";
};


// Inline seek UI per listening button
const inlineSeekMap = new Map(); // Map<button, {intervalId, seekEl, audio}>

function formatClock(sec){
    if (!Number.isFinite(sec)) return '00:00';
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s/60).toString().padStart(2,'0');
    const ss = (s%60).toString().padStart(2,'0');
    return `${m}:${ss}`;
}

function createOrUpdateInlineSeek(button, audio){
    try{
        if (!button || !audio) return;
        const existing = inlineSeekMap.get(button);
        if (existing) { existing.audio = audio; return; }

        const seek = document.createElement('input');
        seek.type = 'range'; seek.min = 0; seek.max = 0; seek.step = 1; seek.value = 0;
        seek.className = 'inline-audio-seek';

        const time = document.createElement('span');
        time.className = 'inline-audio-time';
        time.textContent = '00:00 / 00:00';

        button.parentNode.insertBefore(time, button);
        button.parentNode.insertBefore(seek, button);

        const update = () => {
            if (!audio || !seek || !time) return;
            const dur = Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0;
            seek.max = dur;
            seek.value = Math.floor(audio.currentTime || 0);
            time.textContent = `${formatClock(audio.currentTime || 0)} / ${formatClock(audio.duration || 0)}`;
        };

        const intervalId = setInterval(update, 250);

        seek.addEventListener('input', ()=>{
            const v = Number(seek.value);
            if (Number.isFinite(v) && audio) audio.currentTime = v;
            update();
        });

        inlineSeekMap.set(button, { intervalId, seekEl: seek, timeEl: time, audio });
    } catch(e){/* ignore */}
}

function removeInlineSeek(button){
    try{
        const entry = inlineSeekMap.get(button);
        if (!entry) return;
        clearInterval(entry.intervalId);
        entry.seekEl.remove();
        if (entry.timeEl) entry.timeEl.remove();
        inlineSeekMap.delete(button);
    } catch(e){/* ignore */}
}

function normalizeText(value) {
    return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderTextBlock(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
}

function getAnswerVariants(expected) {
    return String(expected || "")
        .split("/")
        .map(part => normalizeText(part))
        .filter(Boolean);
}

function isAnswerMatch(actual, expected) {
    const normalizedActual = normalizeText(actual);
    const variants = getAnswerVariants(expected);
    if (variants.length === 0) return normalizedActual === normalizeText(expected);
    return variants.includes(normalizedActual);
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

function formatPoint(value) {
    return round2(value).toFixed(2);
}

function toScoreNumber(value) {
    const score = typeof value === "number" ? value : Number(value);
    return Number.isFinite(score) ? score : 0;
}

function toTimestamp(value) {
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function getRankingUserKey(record) {
    const userId = typeof record?.userId === "string" ? record.userId.trim() : "";
    if (userId) return `id:${userId}`;

    const name = typeof record?.name === "string" ? normalizeText(record.name) : "";
    return `name:${name || "anonymous"}`;
}

function getRankingTestKey(record) {
    const test = record?.test;
    if (test == null) return "unknown";
    const testKey = String(test).trim();
    return testKey || "unknown";
}

function getBestRankingsByUserAndTest(records) {
    const bestByUserAndTest = new Map();

    records.forEach((record) => {
        const compositeKey = `${getRankingUserKey(record)}|test:${getRankingTestKey(record)}`;
        const prev = bestByUserAndTest.get(compositeKey);

        if (!prev) {
            bestByUserAndTest.set(compositeKey, record);
            return;
        }

        const prevScore = toScoreNumber(prev.score);
        const currentScore = toScoreNumber(record.score);
        if (currentScore > prevScore) {
            bestByUserAndTest.set(compositeKey, record);
            return;
        }

        if (currentScore === prevScore && toTimestamp(record.date) > toTimestamp(prev.date)) {
            bestByUserAndTest.set(compositeKey, record);
        }
    });

    return Array.from(bestByUserAndTest.values());
}

function setSaveStatus(message, type = "info") {
    const saveStatus = document.getElementById('save-status');
    if (!saveStatus) return;
    saveStatus.textContent = message;
    saveStatus.className = `save-status ${type}`;
}

function formatTimer(seconds) {
    const min = Math.floor(seconds / 60).toString().padStart(2, "0");
    const sec = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
}

function updateTimerDisplay() {
    const timerEl = document.getElementById('timer');
    if (!timerEl) return;
    timerEl.textContent = `Thời gian: ${formatTimer(remainingSeconds)}`;
}

function updateStartButtonState() {
    const startBtn = document.getElementById('start-timer-btn');
    if (!startBtn) return;

    if (hasAutoSubmitted) {
        startBtn.disabled = true;
        startBtn.textContent = 'Hết giờ';
        return;
    }

    if (timerIntervalId) {
        startBtn.disabled = true;
        startBtn.textContent = 'Đang chạy';
        return;
    }

    startBtn.disabled = false;
    startBtn.textContent = hasExamStarted ? 'Đã dừng' : 'Start';
}

function stopExamTimer() {
    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }
    updateStartButtonState();
}

function resetExamTimerState() {
    stopExamTimer();
    remainingSeconds = EXAM_DURATION_SECONDS;
    hasExamStarted = false;
    hasAutoSubmitted = false;
    updateTimerDisplay();
    updateStartButtonState();
}

window.startExamTimer = function() {
    if (!requireLoggedInExamAccess()) {
        return;
    }

    if (timerIntervalId || hasAutoSubmitted) {
        return;
    }

    hasExamStarted = true;
    updateStartButtonState();

    timerIntervalId = setInterval(() => {
        remainingSeconds -= 1;
        updateTimerDisplay();

        if (remainingSeconds <= 0) {
            remainingSeconds = 0;
            hasAutoSubmitted = true;
            stopExamTimer();
            updateTimerDisplay();
            updateStartButtonState();
            showSubmitModal(true);
        }
    }, 1000);
};

function getSelectedTestKey() {
    return "test" + document.getElementById('test-selector').value;
}

function getSectionTestKey(sectionKey) {
    const selectedSectionTest = currentExamPlan?.[sectionKey];
    if (selectedSectionTest && answersData?.[`test${selectedSectionTest}`]) {
        return `test${selectedSectionTest}`;
    }

    const selected = getSelectedTestKey();
    if (answersData?.[selected]) return selected;
    return null;
}

function getResolvedAnswerTestKey() {
    const selected = getSelectedTestKey();
    if (answersData?.[selected]) return selected;
    if (answersData?.test5) return "test5";
    return null;
}

function buildUniformExamPlan(testNumber) {
    const testValue = String(testNumber);
    return {
        reading: testValue,
        writing: testValue,
        listening: testValue,
        speaking: testValue,
    };
}

/**
 * Build a composite exam plan by shuffling tests within a group.
 * If `group` is 'A' use tests 1-8; if 'B' use tests 9-14; if null use all available tests.
 */
function buildCompositeExamPlan(group = null) {
    let pool;
    if (group === 'A') {
        pool = Array.from({length: 8}, (_, i) => i + 1); // 1..8
    } else if (group === 'B') {
        pool = Array.from({length: 6}, (_, i) => i + 9); // 9..14
    } else {
        pool = [...AVAILABLE_TEST_NUMBERS];
    }

    // shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // ensure we have at least 4 values (group B has 6 entries so OK)
    const take = (arr, n) => arr.slice(0, n).map(String);
    const chosen = take(pool, 4);

    return {
        reading: chosen[0] || '1',
        writing: chosen[1] || (chosen[0] || '1'),
        listening: chosen[2] || (chosen[0] || '1'),
        speaking: chosen[3] || (chosen[0] || '1'),
    };
}

function applyExamPlan(plan) {
    currentExamPlan = plan;
}

async function loadAnswersData() {
    answersData = answersBank;
    updateDebug('answers data loaded');
}

function renderMultipleChoiceRow(groupPrefix, questionNumber, choices) {
    return `
        <div class="question-row">
            <b>Câu ${questionNumber}:</b>
            <div class="options">
                ${choices.map(opt => `
                    <label>
                        <input type="radio" name="${groupPrefix}-${questionNumber}" value="${opt}">
                        <span>${opt}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;
}

function renderTextRow(fieldPrefix, questionNumber, placeholder) {
    return `
        <div class="question-row question-row-text">
            <b>Câu ${questionNumber}:</b>
            <input type="text" id="${fieldPrefix}-${questionNumber}" class="text-answer" placeholder="${placeholder}">
        </div>
    `;
}

function getPartNumberFromKey(partKey) {
    const match = String(partKey || "").match(/part(\d+)/i);
    return match ? match[1] : "";
}

function getTestNumberFromTestKey(testKey) {
    const match = String(testKey || "").match(/test(\d+)/i);
    return match ? match[1] : "";
}

function renderListeningAudioButton(partKey, testKey) {
    const partNumber = getPartNumberFromKey(partKey);
    const testNumber = getTestNumberFromTestKey(testKey);
    if (!partNumber) return "";

    const testInfoText = testNumber ? `Test ${testNumber}` : "đề hiện tại";
    return `
        <button
            type="button"
            class="listen-audio-btn"
            data-audio-part="${partNumber}"
            data-audio-test="${testNumber}"
            data-title-play="Chạy audio Part ${partNumber} (${testInfoText})"
            data-title-pause="Dừng audio Part ${partNumber} (${testInfoText})"
            data-aria-play="Chạy audio Part ${partNumber} ${testInfoText}"
            data-aria-pause="Dừng audio Part ${partNumber} ${testInfoText}"
            aria-label="Chạy audio Part ${partNumber} ${testInfoText}"
            title="Chạy audio Part ${partNumber} (${testInfoText})"
        >▶</button>
    `;
}

function getListeningAudioCandidates(testNumber, partNumber) {
    if (!partNumber) return [];
    // Match new file pattern: TEST {testNumber} Part {partNumber}.mp3
    return [
        `assets/audios/${encodeURIComponent(`TEST ${testNumber} Part ${partNumber}.mp3`)}`
    ];
}

async function probeFirstReachable(urls, timeoutMs = 3000) {
    for (const url of urls) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            const resp = await fetch(url, { method: 'HEAD', mode: 'cors', signal: controller.signal });
            clearTimeout(timeoutId);
            if (resp && resp.ok) return url;
        } catch (e) {
            // try next
        }
    }
    throw new Error('No reachable audio URL');
}

function resetActiveListeningButtonState() {
    if (!activeListeningAudioButton) return;
    activeListeningAudioButton.classList.remove("playing", "missing");
    activeListeningAudioButton.textContent = '▶';
    activeListeningAudioButton.title = activeListeningAudioButton.dataset.titlePlay || activeListeningAudioButton.title;
    activeListeningAudioButton.setAttribute('aria-label', activeListeningAudioButton.dataset.ariaPlay || 'Chạy audio');
    activeListeningAudioButton = null;
}

function setActiveListeningButtonPlaying(button, isPlaying) {
    if (!button) return;
    if (isPlaying) {
        button.classList.add("playing");
        button.textContent = '⏸';
        button.title = button.dataset.titlePause || button.title;
        button.setAttribute('aria-label', button.dataset.ariaPause || 'Dừng audio');
    } else {
        button.classList.remove("playing");
        button.textContent = '▶';
        button.title = button.dataset.titlePlay || button.title;
        button.setAttribute('aria-label', button.dataset.ariaPlay || 'Chạy audio');
    }
}

function stopListeningAudioPlayback() {
    activeListeningRequestId += 1;
    if (activeListeningAudio) {
        activeListeningAudio.pause();
        activeListeningAudio.currentTime = 0;
        activeListeningAudio = null;
    }
    try { if (activeListeningAudioButton) removeInlineSeek(activeListeningAudioButton); } catch(e){}
    resetActiveListeningButtonState();
}



function markAudioMissing(button) {
    button.classList.remove("playing");
    button.textContent = '▶';
    button.classList.add("missing");
    setTimeout(() => button.classList.remove("missing"), 1200);
}

async function playListeningAudioWithFallback(candidates, button) {
    try {
        stopListeningAudioPlayback();
        const requestId = ++activeListeningRequestId;
        if (requestId !== activeListeningRequestId) return;

        const url = await probeFirstReachable(candidates, 3000);
        if (requestId !== activeListeningRequestId) return;

        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        activeListeningAudio = audio;
        activeListeningAudioButton = button;
        button.classList.remove("missing");
        setActiveListeningButtonPlaying(button, true);
        try { createOrUpdateInlineSeek(button, audio); } catch(e){}

        audio.addEventListener("ended", () => {
            if (activeListeningAudio === audio) {
                activeListeningAudio = null;
                resetActiveListeningButtonState();
                try { removeInlineSeek(button); } catch(e){}
            }
        }, { once: true });

        audio.addEventListener("error", () => {
            if (activeListeningAudio === audio) {
                markAudioMissing(button);
                removeInlineSeek(button);
            }
        }, { once: true });

        await audio.play();
        if (requestId !== activeListeningRequestId) {
            audio.pause();
            audio.currentTime = 0;
            if (activeListeningAudio === audio) {
                activeListeningAudio = null;
            }
            try { removeInlineSeek(button); } catch(e){}
            return;
        }
    } catch (e) {
        console.warn('[playListeningAudioWithFallback] failed', e);
        markAudioMissing(button);
    }
}

function bindListeningAudioButtons() {
    const buttons = document.querySelectorAll(".listen-audio-btn");
    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            const partNumber = button.getAttribute("data-audio-part");
            const testNumber = button.getAttribute("data-audio-test");
            if (!partNumber) return;

            if (activeListeningAudioButton === button && activeListeningAudio) {
                if (activeListeningAudio.paused) {
                    activeListeningAudio.play().then(() => {
                        setActiveListeningButtonPlaying(button, true);
                    }).catch(e => {
                        console.warn('[resumeListeningAudio] failed', e);
                        markAudioMissing(button);
                    });
                } else {
                    activeListeningAudio.pause();
                    setActiveListeningButtonPlaying(button, false);
                }
                return;
            }

            const candidates = getListeningAudioCandidates(testNumber, partNumber);
            playListeningAudioWithFallback(candidates, button).catch(e => console.warn(e));
        });
    });
}

window.clearPartAnswers = function(skillKey, partKey) {
    // Clear all radio buttons for multiple choice questions
    const radioButtons = document.querySelectorAll(`input[name^="${skillKey}-${partKey}-"]:checked`);
    radioButtons.forEach(radio => radio.checked = false);
    
    // Clear all text inputs for text answer questions
    const textInputs = document.querySelectorAll(`input[id^="${skillKey}-${partKey}-"].text-answer`);
    textInputs.forEach(input => input.value = '');
}



function renderSkillSection(title, skillKey, schema, testKey = "") {
    let html = `<h3 class="sheet-section-title">${title}</h3>`;
    schema.forEach(item => {
        const listeningAudioButton = skillKey === "listening" ? renderListeningAudioButton(item.key, testKey) : "";
        const clearButton = `<button type="button" class="clear-part-btn" onclick="clearPartAnswers('${skillKey}', '${item.key}')">Bỏ chọn</button>`;
        html += `<div class="part-block"><div class="part-header"><h4>${item.part}</h4>${listeningAudioButton}${clearButton}</div>`;
        for (let i = item.from; i <= item.to; i++) {
            if (item.inputType === "text") {
                html += renderTextRow(`${skillKey}-${item.key}`, i, "Nhập đáp án...");
            } else {
                html += renderMultipleChoiceRow(`${skillKey}-${item.key}`, i, item.choices);
            }
        }
        html += `</div>`;
    });
    return html;
}

// 2. Tải ảnh minh họa nếu có (theo pattern assets/images/{test}/img{n}.png)
function getAnswerSectionRenderer(sectionKey, testKey) {
    const testLabel = testKey ? ` - Test ${String(testKey).replace("test", "")}` : "";

    if (sectionKey === "reading") {
        return () => renderSkillSection(`Reading${testLabel}`, "reading", READING_SCHEMA, testKey);
    }

    if (sectionKey === "listening") {
        return () => renderSkillSection(`Listening${testLabel}`, "listening", LISTENING_SCHEMA, testKey);
    }

    return () => renderWritingSection(testLabel, testKey);
}

function renderWritingSample(partLabel, sample) {
    if (!sample) return "";
    const heading = sample.heading ? `<p><b>${escapeHtml(sample.heading)}</b></p>` : "";
    return `
        <div class="part-block">
            <h4>${escapeHtml(partLabel)} - ${escapeHtml(sample.title || "")}</h4>
            <p><i>${escapeHtml(sample.task || "")}</i></p>
            ${heading}
            <div class="writing-sample-content">${renderTextBlock(sample.answer || "")}</div>
        </div>
    `;
}

function renderWritingSection(testLabel = "", testKey = "") {
    const sample = writingSamples?.[testKey];
    const task1Title = sample?.part1?.title || "Task 1";
    const task2Title = sample?.part2?.title || "Task 2";
    const task3Title = sample?.part3?.title || "Task 3";
    const task1Value = escapeHtml(sample?.part1?.answer || "");
    const task2Value = escapeHtml(sample?.part2?.answer || "");
    const task3Value = escapeHtml(sample?.part3?.answer || "");

    return `
        <h3 class="sheet-section-title">Writing${testLabel}</h3>
        <div class="part-block">
            <h4>${escapeHtml(task1Title)}</h4>
            <textarea id="writing-task1" class="writing-box" placeholder="Viết bài cho Task 1...">${task1Value}</textarea>
        </div>
        <div class="part-block">
            <h4>${escapeHtml(task2Title)}</h4>
            <textarea id="writing-task2" class="writing-box" placeholder="Viết bài cho Task 2...">${task2Value}</textarea>
        </div>
        <div class="part-block">
            <h4>${escapeHtml(task3Title)}</h4>
            <textarea id="writing-task3" class="writing-box" placeholder="Viết bài cho Task 3...">${task3Value}</textarea>
        </div>
    `;
}

// 1. Tạo giao diện phiếu đáp án theo cấu trúc đề
function renderQuestions() {
    const area = document.getElementById('questions-area');
    console.debug('[renderQuestions] answersData keys:', answersData ? Object.keys(answersData) : answersData);
    updateDebug('renderQuestions start');
    const selectedTestKey = getSelectedTestKey();
    const hasAnyAnswers = Boolean(answersData?.[selectedTestKey]);

    if (!hasAnyAnswers) {
        area.innerHTML = `<p>Chưa có dữ liệu đáp án cho ${selectedTestKey}. Hãy thêm ${selectedTestKey} vào data/answers.js.</p>`;
        return;
    }

    let html = "";
    currentSectionOrder.forEach((sectionKey) => {
        html += getAnswerSectionRenderer(sectionKey, getSectionTestKey(sectionKey))();
    });
    area.innerHTML = html;
    bindListeningAudioButtons();
}

function scoreSkill(skillKey, schema, answerRoot) {
    let correct = 0;
    let total = 0;

    schema.forEach(item => {
        const partAnswers = answerRoot?.[item.key] || {};
        for (let i = item.from; i <= item.to; i++) {
            const expected = partAnswers[String(i)];
            if (!expected) continue;

            total++;
            if (item.inputType === "text") {
                const input = document.getElementById(`${skillKey}-${item.key}-${i}`);
                const actual = normalizeText(input?.value);
                if (isAnswerMatch(actual, expected)) {
                    correct++;
                }
            } else {
                const selected = document.querySelector(`input[name="${skillKey}-${item.key}-${i}"]:checked`);
                if (selected && isAnswerMatch(selected.value, expected)) {
                    correct++;
                }
            }
        }
    });

    return { correct, total };
}

// 2. Chấm điểm theo answers.json
window.showSubmitModal = function(autoTriggered = false) {
    if (!hasAuthenticatedUser()) {
        redirectToLogin();
        return;
    }

    if (!answersData) {
        alert("Không có dữ liệu đáp án để chấm điểm.");
        return;
    }

    stopExamTimer();

    const readingKey = getSectionTestKey("reading");
    const listeningKey = getSectionTestKey("listening");
    const readingSet = answersData?.[readingKey] || {};
    const listeningSet = answersData?.[listeningKey] || {};
    const reading = scoreSkill("reading", READING_SCHEMA, readingSet.reading);
    const listening = scoreSkill("listening", LISTENING_SCHEMA, listeningSet.listening);
    const readingPoint = reading.total ? (reading.correct / reading.total) * 2.5 : 0;
    const listeningPoint = listening.total ? (listening.correct / listening.total) * 2.5 : 0;
    currentScore = round2(readingPoint + listeningPoint);

    latestResult = {
        totalPoint: currentScore,
        readingPoint: round2(readingPoint),
        listeningPoint: round2(listeningPoint),
        readingCorrect: reading.correct,
        readingTotal: reading.total,
        listeningCorrect: listening.correct,
        listeningTotal: listening.total,
    };

    // Save to personal scores immediately (silent, no confirm)
    try {
        savePersonalScore(latestResult);
    } catch (e) { console.warn('savePersonalScore failed', e); }

    document.getElementById('score-display').innerHTML = `
        <div class="result-score-main">${formatPoint(latestResult.totalPoint)}<span>/5.00</span></div>
        <div class="result-skill-grid">
            <div class="result-skill-card">
                <h4>Reading</h4>
                <p class="result-point">${formatPoint(latestResult.readingPoint)} / 2.50</p>
                <p class="result-meta">Đúng ${latestResult.readingCorrect}/${latestResult.readingTotal}</p>
            </div>
            <div class="result-skill-card">
                <h4>Listening</h4>
                <p class="result-point">${formatPoint(latestResult.listeningPoint)} / 2.50</p>
                <p class="result-meta">Đúng ${latestResult.listeningCorrect}/${latestResult.listeningTotal}</p>
            </div>
        </div>
        <p class="result-note">Writing là tự luận nên không chấm tự động.</p>
    `;

    if (autoTriggered) {
        const startBtn = document.getElementById('start-timer-btn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'Hết giờ';
        }
        alert("Đã hết 120 phút. Hệ thống tự động nộp bài và chấm điểm.");
    }

    syncUserNameInput();

    // Mark answers on the sheet (correct / incorrect)
    try { markAnswers(); } catch (e) { console.warn('markAnswers failed', e); }

    document.getElementById('resultModal').style.display = 'block';
}

function clearPreviousMarks() {
    // Remove marking classes from MCQ spans
    document.querySelectorAll('.options label span').forEach(el => {
        el.classList.remove('answer-correct', 'answer-wrong');
    });
    // Remove badges showing correct answers
    document.querySelectorAll('.correct-answer-badge').forEach(el => el.remove());
    // Remove classes from text answers
    document.querySelectorAll('.text-answer').forEach(el => {
        el.classList.remove('answer-correct', 'answer-wrong');
    });
}

function markAnswers() {
    try {
        clearPreviousMarks();

        // Only mark reading and listening (writing is manual)
        const sectionsToMark = ['reading', 'listening'];
        sectionsToMark.forEach((sectionKey) => {
            const schema = sectionKey === 'reading' ? READING_SCHEMA : LISTENING_SCHEMA;
            const testKey = getSectionTestKey(sectionKey) || getSelectedTestKey();
            const answersRoot = answersData?.[testKey] || {};
            const answerSet = answersRoot[sectionKey] || {};

            schema.forEach(item => {
                for (let i = item.from; i <= item.to; i++) {
                    const expected = answerSet?.[item.key]?.[String(i)];
                    if (!expected) continue; // no expected answer

                    if (item.inputType === 'text') {
                        const input = document.getElementById(`${sectionKey}-${item.key}-${i}`);
                        if (!input) continue;
                        const actual = normalizeText(input.value || '');
                        const isCorrect = isAnswerMatch(actual, expected);
                        if (isCorrect) {
                            input.classList.add('answer-correct');
                        } else {
                            input.classList.add('answer-wrong');
                            // show expected answer next to input (green badge)
                            const hint = document.createElement('span');
                            hint.className = 'correct-answer-badge';
                            hint.textContent = `Đáp án: ${String(expected).split('/').join(' / ')}`;
                            const next = input.nextElementSibling;
                            if (!next || !next.classList || !next.classList.contains('correct-answer-badge')) {
                                input.parentNode.insertBefore(hint, input.nextSibling);
                            }
                        }
                    } else {
                        // multiple choice: highlight user's choice (green if correct, red if wrong)
                        // and show correct answer if user was wrong
                        const name = `${sectionKey}-${item.key}-${i}`;
                        const selected = document.querySelector(`input[name="${name}"]:checked`);
                        
                        if (selected) {
                            const isSelCorrect = isAnswerMatch(selected.value, expected);
                            const selSpan = selected.nextElementSibling;
                            if (selSpan) {
                                selSpan.classList.add(isSelCorrect ? 'answer-correct' : 'answer-wrong');
                            }
                            
                            // If user chose wrong, also highlight the correct answer in green
                            if (!isSelCorrect) {
                                const inputs = document.getElementsByName(name) || [];
                                for (let k = 0; k < inputs.length; k++) {
                                    const ip = inputs[k];
                                    if (isAnswerMatch(ip.value, expected)) {
                                        const correctSpan = ip.nextElementSibling;
                                        if (correctSpan) {
                                            correctSpan.classList.add('answer-correct');
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            });
        });
    } catch (e) {
        console.warn('markAnswers error', e);
    }
}

// 2.1. Đổi test: render lại số câu
window.changeTest = function(preserveCurrentPlan = false) {
    if (!preserveCurrentPlan) {
        const selectedTestNumber = document.getElementById('test-selector').value;
        applyExamPlan(buildUniformExamPlan(selectedTestNumber));
    }
    renderQuestions();

    // Ensure image viewer updates to the active reading test.
    const selector = document.getElementById('test-selector');
    const testToLoad = selector ? selector.value : (currentExamPlan?.reading || '1');
    if (typeof window.loadForTest === 'function') {
        try { window.loadForTest(testToLoad); } catch (e) { console.warn('loadForTest failed', e); }
    }
}

window.randomTest = function() {
    const randomIndex = Math.floor(Math.random() * AVAILABLE_TEST_NUMBERS.length);
    const randomTestNumber = AVAILABLE_TEST_NUMBERS[randomIndex];
    const selector = document.getElementById('test-selector');

    selector.value = String(randomTestNumber);
    applyExamPlan(buildUniformExamPlan(randomTestNumber));
    changeTest(true);
}

window.shuffleTestParts = function() {
    const selector = document.getElementById('test-selector');
    // Pick group A (1-8) or group B (9-14) at random
    const group = Math.random() < 0.5 ? 'A' : 'B';
    const randomPlan = buildCompositeExamPlan(group);
    // Set selector to the chosen reading test number
    if (selector) selector.value = String(randomPlan.reading);
    applyExamPlan(randomPlan);
    // annotate for debugging what group was chosen
    try { console.info('shuffleTestParts selected group', group, randomPlan); } catch(e) {}
    changeTest(true);
}

window.resetExam = function() {
    currentScore = 0;
    latestResult = null;
    resetExamTimerState();

    const userNameInput = document.getElementById('userName');
    if (userNameInput) userNameInput.value = "";

    closeModal();
    renderQuestions();

    const answerPanel = document.querySelector('.answer-container');
    if (answerPanel) {
        answerPanel.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// 3. Lưu lên Firebase
window.saveScoreToFirebase = async function() {
    const currentUser = getCurrentUser();
    const loggedInName = getLoggedInUserName();

    if (!currentUser?.id || !loggedInName) {
        alert("Vui lòng đăng nhập để lưu điểm đúng theo tài khoản.");
        return;
    }

    if (!db) {
        setSaveStatus("Chưa cấu hình Firebase nên chưa lưu điểm được.", "error");
        return;
    }

    try {
        const totalPoint = latestResult?.totalPoint ?? currentScore;
        setSaveStatus("Đang lưu", "info");
        const rankingRef = push(ref(db, "rankings"));
        const rankingKey = rankingRef.key;
        if (!rankingKey) {
            throw new Error("Không tạo được mã bản ghi ranking.");
        }

        const scorePayload = {
            name: loggedInName,
            userId: currentUser.id,
            score: totalPoint,
            maxScore: 5,
            readingScore: latestResult?.readingPoint ?? null,
            listeningScore: latestResult?.listeningPoint ?? null,
            test: document.getElementById('test-selector').value,
            section: "all",
            date: new Date().toISOString()
        };

        await update(ref(db), {
            [`rankings/${rankingKey}`]: scorePayload,
            [`users/${currentUser.id}/results/${rankingKey}`]: scorePayload,
        });

        setSaveStatus(`Đã lưu: ${rankingKey}`, "success");
        setTimeout(() => location.reload(), 1200);
    } catch (e) {
        console.error("Lỗi: ", e);
        setSaveStatus(`Không lưu được lên Realtime Database: ${e?.code || "unknown"} ${e?.message || e}`, "error");
    }
}

// 4. Lấy bảng xếp hạng
async function loadLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) {
        return;
    }

    if (!db) {
        list.innerHTML = "";
        return;
    }

    const snapshot = await get(ref(db, "rankings"));
    const items = [];

    snapshot.forEach(childSnap => {
        const value = childSnap.val();
        if (value && typeof value === "object") {
            items.push(value);
        }
    });

    const bestItems = getBestRankingsByUserAndTest(items);
    bestItems.sort((a, b) => toScoreNumber(b.score) - toScoreNumber(a.score));
    list.innerHTML = "";

    bestItems.slice(0, 10).forEach(d => {
        const score = toScoreNumber(d.score);
        const isPointScale = d.maxScore === 5 || score <= 5;
        const scoreText = isPointScale ? `${formatPoint(score)}/5.00 điểm` : `${score} câu`;
        list.innerHTML += `<li>${d.name} - Test ${d.test || "-"} - ${scoreText}</li>`;
    });
}

window.closeModal = () => document.getElementById('resultModal').style.display = 'none';

// Chạy lần đầu
async function initApp() {
    syncAuthActionButton();
    // Allow page to initialize even when not logged in so questions render.
    // Login is still required for starting the exam or submitting answers.

    const header = document.querySelector('header');
    if (header) {
        header.querySelectorAll('.header-actions button, .header-actions a').forEach((el) => {
            el.addEventListener('click', () => closeMobileMenu());
        });

        const testSelector = header.querySelector('#test-selector');
        if (testSelector) {
            testSelector.addEventListener('change', () => closeMobileMenu());
        }
    }

    syncUserNameInput();

    try {
        await loadAnswersData();
    } catch (error) {
        console.error("Lỗi tải đáp án:", error);
        const area = document.getElementById('questions-area');
        area.innerHTML = `<p>Không tải được data/answers.json</p>`;
    }

    if (isShufflePage) {
        shuffleTestParts();
    } else {
        applyExamPlan(buildUniformExamPlan(getSelectedTestKey().replace('test', '')));
        changeTest();
    }
    resetExamTimerState();
    loadLeaderboard();
}

if (!window.SKIP_APP_INIT) {
    initApp();
} else {
    // expose minimal firebase status when module loaded but app init skipped
    try { syncAuthActionButton(); } catch(e){}
}