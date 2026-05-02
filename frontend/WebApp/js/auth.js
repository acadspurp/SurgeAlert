import { API_BASE_URL } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAIoh6tolkRR3QRh2j1qmUK8znWMoUhkBQ",
    authDomain: "surgealert-system.firebaseapp.com",
    databaseURL: "https://surgealert-system-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "surgealert-system",
    storageBucket: "surgealert-system.firebasestorage.app",
    messagingSenderId: "135598658205",
    appId: "1:135598658205:web:73839ede354c388a517a74",
    measurementId: "G-KX9RXEEG5T"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- BACKEND SYNC & ROLE CHECK ---
async function syncUserWithBackend(user) {
    if (!user) return null;
    try {
        const token = await user.getIdToken();
        
        // Prepare data to send to backend
        const userData = {
            email: user.email,
            fullName: user.displayName || user.email.split('@')[0],
            role: "ADMIN" // Defaulting to ADMIN for your first setup (change logic later if needed)
        };

        const response = await fetch(`${API_BASE_URL}/auth/sync-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            // The backend now returns the full User Object including the ROLE
            const dbUser = await response.json();
            console.log("Backend Sync Success. Role:", dbUser.role);
            return dbUser;
        } else {
            console.error("Backend sync failed status:", response.status);
        }
    } catch (error) {
        console.error("Backend sync error:", error);
    }
    return null;
}

// --- LOGOUT ---
async function handleLogout() {
    try {
        await signOut(auth);
        // If we are on the admin page, force back to home
        if (window.location.pathname.includes('admin.html')) {
             window.location.href = 'index.html';
        } else {
            if (window.showView) window.showView('home');
            alert('Logged out successfully!');
            // Force reload to reset UI states
            window.location.reload();
        }
    } catch (error) {
        console.error("Logout error:", error);
    }
}

// --- PASSWORD RESET ---
async function handlePasswordReset() {
    const emailInput = document.getElementById('login-email');
    const email = emailInput ? emailInput.value : null;
    
    if (!email) {
        alert('Please enter your email in the login field first.');
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        alert('Password reset email sent! Check your inbox.');
    } catch (error) {
        console.error(error);
        alert('Error sending reset email: ' + error.message);
    }
}

// --- MAIN INITIALIZATION ---
export function initializeAuth() {
    // Expose functions globally for HTML onclick events
    window.handleLogout = handleLogout;
    window.handlePasswordReset = handlePasswordReset;

    // Login Form Listener
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            try {
                await signInWithEmailAndPassword(auth, email, password);
                // Alert is optional here because onAuthStateChanged will handle the redirect
                // alert('Login successful!');
                loginForm.reset();
            } catch (error) {
                console.error(error);
                alert('Login failed: ' + error.message);
            }
        });
    }

    // --- AUTH STATE OBSERVER (The "Brain" of the Auth) ---
    onAuthStateChanged(auth, async (user) => {
        // UI Elements
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userName = document.getElementById('user-name');
        const mobileLoginBtn = document.getElementById('mobile-login-btn');
        const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

        if (user) {
            // 1. Update UI for Logged In State
            if(loginBtn) loginBtn.style.display = 'none';
            if(logoutBtn) logoutBtn.style.display = 'inline-block';
            if(userName) {
                userName.style.display = 'inline-block';
                userName.textContent = `User: ${user.email}`;
            }
            if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
            if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'block';

            // 2. Sync with Backend and Check Role
            const dbUser = await syncUserWithBackend(user);

            // 3. REDIRECTION LOGIC
            if (dbUser && (dbUser.role === 'ADMIN' || dbUser.role === 'HEAD_ADMIN')) {
                // If user is Admin, but currently on the Public Home Page (index.html), send them to Dashboard
                if (!window.location.pathname.includes('admin.html')) {
                    console.log("Admin detected. Redirecting to Dashboard...");
                    window.location.href = 'admin.html';
                }
            }
            
        } else {
            // User is Logged Out
            if(loginBtn) loginBtn.style.display = 'inline-block';
            if(logoutBtn) logoutBtn.style.display = 'none';
            if(userName) userName.style.display = 'none';
            if (mobileLoginBtn) mobileLoginBtn.style.display = 'block';
            if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'none';

            // SECURITY: If user logs out while on admin.html, kick them out
            if (window.location.pathname.includes('admin.html')) {
                window.location.href = 'index.html';
            }
        }
    });
}