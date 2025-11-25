import { API_BASE_URL } from './config.js';

// --- SESSION MANAGEMENT ---
export const getUser = () => {
    const userStr = localStorage.getItem('surge_user');
    return userStr ? JSON.parse(userStr) : null;
};

export const setUser = (user) => {
    localStorage.setItem('surge_user', JSON.stringify(user));
};

export const clearUser = () => {
    localStorage.removeItem('surge_user');
};

// --- API CALLS ---
export async function login(username, password) {
    try {
        console.log(`Attempting login for: ${username}`); // Debug Log
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // This sends {"username": "admin", "password": "..."} matching your Controller
            body: JSON.stringify({ username, password }) 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Invalid username or password');
        }

        const user = await response.json();
        console.log("Login Response:", user); // Debug Log
        setUser(user);
        return user;
    } catch (error) {
        console.error("Login Error:", error);
        throw error;
    }
}

export function handleLogout() {
    clearUser();
    
    // Redirect logic
    if (window.location.pathname.includes('admin.html')) {
        window.location.href = 'index.html';
    } else {
        window.location.reload();
    }
}

// --- INITIALIZATION ---
export function initializeAuth() {
    // Expose logout globally for HTML onclick events
    window.handleLogout = handleLogout;

    const user = getUser();
    updateAuthUI(user);

    // Setup Login Form Listener
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // FIXED: Getting element by correct ID 'login-username'
            const usernameInput = document.getElementById('login-username');
            const passInput = document.getElementById('login-password');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            const username = usernameInput.value.trim();
            const password = passInput.value;

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = "Logging in...";

                const user = await login(username, password);
                
                // Check Role exactly as it appears in DB (ADMIN)
                if(user.role === 'ADMIN' || user.role === 'HEAD_ADMIN') {
                    window.location.href = 'admin.html';
                } else {
                    alert('Login successful! Welcome ' + (user.fullName || user.username));
                    document.getElementById('login-view').classList.add('hidden');
                    document.getElementById('home-view').classList.remove('hidden');
                    updateAuthUI(user);
                }
            } catch (error) {
                alert('Login failed: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Login";
                loginForm.reset();
            }
        });
    }
}

function updateAuthUI(user) {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const mobileLoginBtn = document.getElementById('mobile-login-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

    if (user) {
        // User is Logged In
        if(loginBtn) loginBtn.style.display = 'none';
        if(logoutBtn) logoutBtn.style.display = 'inline-block';
        // Mobile
        if(mobileLoginBtn) mobileLoginBtn.style.display = 'none';
        if(mobileLogoutBtn) mobileLogoutBtn.style.display = 'block';
    } else {
        // User is Logged Out
        if(loginBtn) loginBtn.style.display = 'inline-block';
        if(logoutBtn) logoutBtn.style.display = 'none';
        // Mobile
        if(mobileLoginBtn) mobileLoginBtn.style.display = 'block';
        if(mobileLogoutBtn) mobileLogoutBtn.style.display = 'none';
    }
}