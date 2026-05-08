import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "1234";

let app = null;
let db = null;
let allRecords = [];
let activeRecords = [];
let allAccounts = [];
let activeAccounts = [];
let loggedIn = false;
let currentView = "scores";

const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const viewTabs = document.getElementById("view-tabs");
const tabScores = document.getElementById("tab-scores");
const tabAccounts = document.getElementById("tab-accounts");
const dashboardTitle = document.getElementById("dashboard-title");
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("login-error");
const testFilterGroup = document.getElementById("test-filter-group");
const testFilter = document.getElementById("test-filter");
const searchLabel = document.getElementById("search-label");
const nameSearch = document.getElementById("name-search");
const scoresPanel = document.getElementById("scores-panel");
const accountsPanel = document.getElementById("accounts-panel");
const adminTableBody = document.getElementById("admin-table-body");
const accountsTableBody = document.getElementById("accounts-table-body");
const summaryText = document.getElementById("summary-text");
const statusText = document.getElementById("status-text");
const accountsStatusText = document.getElementById("accounts-status-text");
const refreshBtn = document.getElementById("refresh-btn");
const logoutBtn = document.getElementById("logout-btn");

function toPoint(value) {
    const numberValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numberValue)) return "0.00";
    return numberValue.toFixed(2);
}

function toTimeText(dateValue) {
    if (!dateValue) return "-";

    if (typeof dateValue?.toDate === "function") {
        return dateValue.toDate().toLocaleString("vi-VN");
    }

    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleString("vi-VN");
}

function setStatus(message, isError = false) {
    statusText.textContent = message;
    statusText.classList.toggle("error-text", isError);
}

function setAccountsStatus(message, isError = false) {
    accountsStatusText.textContent = message;
    accountsStatusText.classList.toggle("error-text", isError);
}

function showLogin() {
    loginPanel.classList.remove("hidden");
    dashboard.classList.add("hidden");
    viewTabs.classList.add("hidden");
    loggedIn = false;
    currentView = "scores";
    usernameInput.value = "";
    passwordInput.value = "";
    loginError.textContent = "";
}

function showDashboard() {
    loginPanel.classList.add("hidden");
    dashboard.classList.remove("hidden");
    viewTabs.classList.remove("hidden");
    loggedIn = true;
    switchView(currentView);
}

function normalizeText(value) {
    return (value || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeAccountFromUserNode(userId, userData) {
    const results = userData?.results && typeof userData.results === "object" ? Object.values(userData.results) : [];
    return {
        userId,
        displayName: userData?.displayName || userId,
        password: userData?.password || "",
        createdAt: userData?.createdAt || "",
        resultsCount: results.length,
    };
}

function switchView(nextView) {
    currentView = nextView === "accounts" ? "accounts" : "scores";
    const showingScores = currentView === "scores";

    scoresPanel.classList.toggle("hidden", !showingScores);
    accountsPanel.classList.toggle("hidden", showingScores);
    tabScores.classList.toggle("active", showingScores);
    tabAccounts.classList.toggle("active", !showingScores);
    tabScores.setAttribute("aria-selected", String(showingScores));
    tabAccounts.setAttribute("aria-selected", String(!showingScores));

    testFilterGroup.classList.toggle("hidden", !showingScores);
    searchLabel.textContent = showingScores ? "Tìm theo tên" : "Tìm theo tài khoản";
    nameSearch.placeholder = showingScores ? "Nhập tên học viên..." : "Nhập ID hoặc tên tài khoản...";
    dashboardTitle.textContent = showingScores ? "Danh sách bài làm" : "Danh sách tài khoản";

    if (showingScores) {
        applyFilters();
    } else {
        applyAccountFilters();
    }
}

function applyFilters() {
    const selectedTest = testFilter.value;
    const searchTerm = normalizeText(nameSearch.value);

    activeRecords = allRecords.filter((record) => {
        const matchTest = selectedTest === "all" || String(record.test || "") === selectedTest;
        const matchName = !searchTerm || normalizeText(record.name).includes(searchTerm);
        return matchTest && matchName;
    });

    renderTable();
}

function applyAccountFilters() {
    const searchTerm = normalizeText(nameSearch.value);

    activeAccounts = allAccounts.filter((account) => {
        if (!searchTerm) return true;
        const idMatch = normalizeText(account.userId).includes(searchTerm);
        const nameMatch = normalizeText(account.displayName).includes(searchTerm);
        return idMatch || nameMatch;
    });

    renderAccountsTable();
}

function renderTable() {
    if (!adminTableBody) return;

    if (!activeRecords.length) {
        adminTableBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-cell">Không có dữ liệu phù hợp bộ lọc hiện tại.</td>
            </tr>
        `;
        summaryText.textContent = `Hiển thị 0 / ${allRecords.length} bản ghi`;
        return;
    }

    adminTableBody.innerHTML = activeRecords.map((record, index) => `
        <tr>
            <td><span class="rank-badge">${index + 1}</span></td>
            <td>${record.name || "Ẩn danh"}</td>
            <td><strong>${toPoint(record.score)}/5.00</strong></td>
            <td>${record.readingScore != null ? `${toPoint(record.readingScore)}/2.50` : "-"}</td>
            <td>${record.listeningScore != null ? `${toPoint(record.listeningScore)}/2.50` : "-"}</td>
            <td>Test ${record.test || "-"}</td>
            <td>${toTimeText(record.date)}</td>
            <td class="mono">${record.key || "-"}</td>
            <td>
                <div class="row-actions">
                    <button class="btn btn-danger btn-row" type="button" data-delete-key="${record.key || ""}">Xóa</button>
                </div>
            </td>
        </tr>
    `).join("");

    adminTableBody.querySelectorAll("[data-delete-key]").forEach((button) => {
        button.addEventListener("click", async () => {
            const deleteKey = button.getAttribute("data-delete-key");
            if (!deleteKey) return;

            const targetRecord = allRecords.find((record) => record.key === deleteKey);
            const label = targetRecord?.name ? `${targetRecord.name} (Test ${targetRecord.test || "-"})` : deleteKey;

            if (!confirm(`Xóa bản ghi ${label}? Hành động này không thể hoàn tác.`)) {
                return;
            }

            try {
                setStatus("Đang xóa bản ghi...");
                await remove(ref(db, `rankings/${deleteKey}`));
                setStatus("Đã xóa bản ghi.");
                await loadAdminData();
            } catch (error) {
                console.error(error);
                setStatus(`Không xóa được: ${error?.code || "unknown"} ${error?.message || error}`, true);
            }
        });
    });

    summaryText.textContent = `Hiển thị ${activeRecords.length} / ${allRecords.length} bản ghi`;
}

function renderAccountsTable() {
    if (!accountsTableBody) return;

    if (!activeAccounts.length) {
        accountsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">Không có tài khoản phù hợp bộ lọc hiện tại.</td>
            </tr>
        `;
        summaryText.textContent = `Hiển thị 0 / ${allAccounts.length} tài khoản`;
        return;
    }

    accountsTableBody.innerHTML = activeAccounts.map((account, index) => `
        <tr>
            <td><span class="rank-badge">${index + 1}</span></td>
            <td class="mono">${account.userId || "-"}</td>
            <td>${account.displayName || "-"}</td>
            <td>${account.password || "-"}</td>
            <td>${toTimeText(account.createdAt)}</td>
            <td>${account.resultsCount}</td>
            <td>
                <div class="row-actions">
                    <button class="btn btn-danger btn-row" type="button" data-delete-user-id="${account.userId || ""}">Xóa tài khoản</button>
                </div>
            </td>
        </tr>
    `).join("");

    accountsTableBody.querySelectorAll("[data-delete-user-id]").forEach((button) => {
        button.addEventListener("click", async () => {
            const deleteUserId = button.getAttribute("data-delete-user-id");
            if (!deleteUserId) return;

            const targetAccount = allAccounts.find((account) => account.userId === deleteUserId);
            const label = targetAccount?.displayName || deleteUserId;

            if (!confirm(`Xóa tài khoản ${label}? Tất cả bài làm gắn với tài khoản này cũng sẽ bị xóa.`)) {
                return;
            }

            try {
                setAccountsStatus("Đang xóa tài khoản...");

                const linkedRankingKeys = allRecords
                    .filter((record) => record.userId === deleteUserId)
                    .map((record) => record.key)
                    .filter(Boolean);

                await remove(ref(db, `users/${deleteUserId}`));

                if (linkedRankingKeys.length) {
                    await Promise.all(
                        linkedRankingKeys.map((rankingKey) => remove(ref(db, `rankings/${rankingKey}`)))
                    );
                }

                setAccountsStatus(`Đã xóa tài khoản ${label}.`);
                setStatus(`Đã xóa ${linkedRankingKeys.length} bản ghi điểm liên quan.`);
                await loadAdminData();
                switchView("accounts");
            } catch (error) {
                console.error(error);
                setAccountsStatus(`Không xóa được tài khoản: ${error?.code || "unknown"} ${error?.message || error}`, true);
            }
        });
    });

    summaryText.textContent = `Hiển thị ${activeAccounts.length} / ${allAccounts.length} tài khoản`;
}

async function loadAdminData() {
    if (!db) {
        allRecords = [];
        activeRecords = [];
        allAccounts = [];
        activeAccounts = [];
        adminTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-cell">Chưa cấu hình Firebase.</td>
            </tr>
        `;
        accountsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">Chưa cấu hình Firebase.</td>
            </tr>
        `;
        summaryText.textContent = "Không thể tải dữ liệu.";
        setAccountsStatus("", false);
        return;
    }

    setStatus("Đang tải dữ liệu...");
    setAccountsStatus("Đang tải dữ liệu...");

    try {
        const [rankingSnapshot, usersSnapshot] = await Promise.all([
            get(ref(db, "rankings")),
            get(ref(db, "users")),
        ]);

        const records = [];

        rankingSnapshot.forEach((childSnap) => {
            const value = childSnap.val();
            if (value && typeof value === "object") {
                records.push({
                    key: childSnap.key,
                    ...value,
                });
            }
        });

        records.sort((a, b) => {
            const scoreDelta = (Number(b.score) || 0) - (Number(a.score) || 0);
            if (scoreDelta !== 0) return scoreDelta;
            return String(b.date || "").localeCompare(String(a.date || ""));
        });

        const accounts = [];
        usersSnapshot.forEach((childSnap) => {
            const userData = childSnap.val();
            if (userData && typeof userData === "object") {
                accounts.push(normalizeAccountFromUserNode(childSnap.key, userData));
            }
        });

        accounts.sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")));

        allRecords = records;
        allAccounts = accounts;
        applyFilters();
        applyAccountFilters();

        setStatus(`Đã tải ${allRecords.length} bản ghi.`);
        setAccountsStatus(`Đã tải ${allAccounts.length} tài khoản.`);
    } catch (error) {
        console.error(error);
        allRecords = [];
        activeRecords = [];
        allAccounts = [];
        activeAccounts = [];
        adminTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-cell">Không thể tải dữ liệu từ Realtime Database.</td>
            </tr>
        `;
        accountsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">Không thể tải danh sách tài khoản từ Realtime Database.</td>
            </tr>
        `;
        summaryText.textContent = "Lỗi tải dữ liệu.";
        setStatus(`Lỗi: ${error?.code || "unknown"} ${error?.message || error}`, true);
        setAccountsStatus(`Lỗi: ${error?.code || "unknown"} ${error?.message || error}`, true);
    }
}

loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        loginError.textContent = "";
        nameSearch.value = "";
        testFilter.value = "all";
        currentView = "scores";
        showDashboard();
        loadAdminData();
        return;
    }

    loginError.textContent = "Sai tài khoản hoặc mật khẩu.";
});

testFilter.addEventListener("change", () => {
    if (loggedIn) {
        applyFilters();
    }
});

nameSearch.addEventListener("input", () => {
    if (loggedIn) {
        if (currentView === "scores") {
            applyFilters();
        } else {
            applyAccountFilters();
        }
    }
});

refreshBtn.addEventListener("click", () => {
    if (loggedIn) {
        loadAdminData();
    }
});

logoutBtn.addEventListener("click", () => {
    showLogin();
});

tabScores.addEventListener("click", () => {
    if (!loggedIn) return;
    switchView("scores");
});

tabAccounts.addEventListener("click", () => {
    if (!loggedIn) return;
    switchView("accounts");
});

if (firebaseConfig?.apiKey) {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
}

showLogin();