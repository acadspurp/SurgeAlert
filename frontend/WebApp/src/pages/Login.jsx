import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/api.js';
import { setSession } from '../services/auth.js';

export default function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setLoading(true);

            const session = await loginUser(username.trim(), password);
            
            if (!session || !session.accessToken) {
                throw new Error("Invalid response from server.");
            }

            const user = {
                id: session.id,
                username: session.username,
                fullName: session.fullName,
                role: session.role
            };
            setSession({
                user,
                accessToken: session.accessToken,
                refreshToken: session.refreshToken,
                accessExpiresAt: session.accessExpiresAt
            });

            // --- CRITICAL ROLE CHECK & REDIRECT LOGIC ---
            const rawRole = session.role || "";
            const normalizedRole = String(rawRole).toUpperCase().trim();

            if (normalizedRole === 'ADMIN' || normalizedRole === 'HEAD_ADMIN') {
                alert('Login successful! Redirecting to Admin Dashboard.');
                navigate('/admin');
            } else {
                alert('Login successful! Welcome ' + (user.fullName || user.username));
                navigate('/');
            }

        } catch (error) {
            console.error("Login process error:", error);
            const message = error.message?.includes('401') || error.message?.includes('403') 
                ? 'Incorrect username or password.' 
                : error.message || 'An unexpected error occurred.';
            alert('Login failed: ' + message);
        } finally {
            setLoading(false);
            setPassword('');
        }
    };

    return (
        <div id="login-view" className="px-2 sm:px-0">
            <div className="mx-auto mt-6 max-w-sm custom-card sm:mt-10">
                <h2 className="text-2xl font-semibold mb-6 text-center section-title">Login</h2>
                <form id="login-form" onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-medium mb-2">Username</label>
                        <input
                            type="text"
                            id="login-username"
                            className="custom-input"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="login-password">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="login-password"
                                name="password"
                                autoComplete="current-password"
                                className="custom-input custom-input--with-trailing-btn"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6BA1B9]"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-lg`} aria-hidden></i>
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="custom-btn btn-blue w-full" disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}
