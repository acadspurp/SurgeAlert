import { API_BASE_URL } from './config.js';

// --- SESSION MANAGEMENT ---

export const getUser = () => {
    const userStr = localStorage.getItem('surge_user');
    try {
        return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
        console.error("Error parsing user from storage", e);
        return null;
    }
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
        console.log(`Sending login request for: ${username}`);
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Invalid username or password');
        }

        const user = await response.json();
        console.log("BACKEND RESPONSE (User):", user);
        setUser(user);
        return user;
    } catch (error) {
        console.error("Login Error:", error);
        throw error;
    }
}

export function handleLogout() {
    clearUser();
    // Force redirect to home page
    window.location.href = 'index.html';
}

// --- INITIALIZATION & UI ---

export function updateAuthUI(user) {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const mobileLoginBtn = document.getElementById('mobile-login-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

    // Toggle buttons based on login state
    if (user) {
        // Desktop
        if(loginBtn) loginBtn.style.display = 'none';
        if(logoutBtn) logoutBtn.style.display = 'inline-block';
        // Mobile
        if(mobileLoginBtn) mobileLoginBtn.style.display = 'none';
        if(mobileLogoutBtn) mobileLogoutBtn.style.display = 'block';
    } else {
        // Desktop
        if(loginBtn) loginBtn.style.display = 'inline-block';
        if(logoutBtn) logoutBtn.style.display = 'none';
        // Mobile
        if(mobileLoginBtn) mobileLoginBtn.style.display = 'block';
        if(mobileLogoutBtn) mobileLogoutBtn.style.display = 'none';
    }
}

export function initializeAuth() {
    // Expose logout globally so HTML onclick works
    window.handleLogout = handleLogout;

    const user = getUser();
    updateAuthUI(user);

    // Setup Login Form Listener
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById('login-username');
            const passInput = document.getElementById('login-password');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            const username = usernameInput.value.trim();
            const password = passInput.value;

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = "Logging in...";

                const user = await login(username, password);

                // --- CRITICAL ROLE CHECK & REDIRECT LOGIC ---
                const rawRole = user.role || "";
                // Normalize: "Admin", "admin", "ADMIN " -> "ADMIN"
                const normalizedRole = String(rawRole).toUpperCase().trim();

                console.log("Detected Role:", normalizedRole);

                if (normalizedRole === 'ADMIN' || normalizedRole === 'HEAD_ADMIN') {
                    console.log("Admin detected. Redirecting to Dashboard...");
                    alert('Login successful! Redirecting to Admin Dashboard.');
                    // Use href to navigate to the admin page
                    window.location.href = 'admin.html';
                } else {
                    // Standard User Logic (Stay on Home Page)
                    alert('Login successful! Welcome ' + (user.fullName || user.username));

                    // Hide Login View, Show Home View
                    const loginView = document.getElementById('login-view');
                    const homeView = document.getElementById('home-view');
                    if(loginView) loginView.classList.add('hidden');
                    if(homeView) homeView.classList.remove('hidden');

                    updateAuthUI(user);
                }

            } catch (error) {
                alert('Login failed: ' + error.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Login";
                }
                loginForm.reset();
            }
        });
    }
}