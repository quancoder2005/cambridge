import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const RESERVED_ADMIN_USER_ID = "admin";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function setAuthStatus(message, type = "info") {
    const statusEl = document.getElementById("auth-status");
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `auth-status ${type}`;
}

function bindEnterToLogin() {
    const fullNameInput = document.getElementById("fullName");
    const passwordInput = document.getElementById("password");
    const inputs = [fullNameInput, passwordInput].filter(Boolean);

    inputs.forEach((input) => {
        input.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            window.handleAuth("login");
        });
    });
}

// 1. Ham don dep ten de lam ID thu muc (Xoa dau, thay cach bang gach duoi)
function createUserId(name) {
    return name.trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "");
}

// 2. Ham xu ly Dang nhap / Dang ky
window.handleAuth = async function(mode) {
    const fullName = document.getElementById("fullName").value.trim();
    const password = document.getElementById("password").value;

    if (!fullName || !password) {
        setAuthStatus("Vui lòng điền đầy đủ tên và mật khẩu.", "error");
        return;
    }

    const userId = createUserId(fullName);
    const userRef = ref(db, "users/" + userId);

    if (mode === "register" && userId.toLowerCase() === RESERVED_ADMIN_USER_ID) {
        setAuthStatus("Không thể tạo tài khoản với tên admin.", "error");
        return;
    }

    try {
        setAuthStatus(mode === "login" ? "Đang đăng nhập..." : "Đang tạo tài khoản...", "info");
        const rootRef = ref(db);
        const snapshot = await get(child(rootRef, "users/" + userId));

        if (mode === "register") {
            // Xu ly dang ky
            if (snapshot.exists()) {
                setAuthStatus("Tên này đã có người đăng ký. Vui lòng thêm số hoặc đổi tên khác.", "error");
            } else {
                // Tao thu muc moi mang ten nguoi do
                await set(userRef, {
                    displayName: fullName,
                    password: password,
                    createdAt: new Date().toISOString()
                });
                setAuthStatus("Tạo tài khoản thành công! Giờ bạn có thể đăng nhập.", "success");
            }
        }
        else if (mode === "login") {
            // Xu ly dang nhap
            if (snapshot.exists()) {
                const userData = snapshot.val();
                if (userData.password === password) {
                    setAuthStatus("Đăng nhập thành công! Đang chuyển trang...", "success");

                    localStorage.setItem("currentUser", JSON.stringify({
                        id: userId,
                        name: userData.displayName
                    }));

                    setTimeout(() => {
                        window.location.href = "index.html";
                    }, 350);
                } else {
                    setAuthStatus("Sai mật khẩu.", "error");
                }
            } else {
                setAuthStatus("Không tìm thấy tên này. Hãy nhấn 'Tạo tài khoản'.", "error");
            }
        }
    } catch (error) {
        console.error(error);
        setAuthStatus("Có lỗi xảy ra: " + error.message, "error");
    }
};

bindEnterToLogin();