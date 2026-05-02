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

            console.log("Detected Role:", normalizedRole);

            if (normalizedRole === 'ADMIN' || normalizedRole === 'HEAD_ADMIN') {
                console.log("Admin detected. Redirecting to Dashboard...");
                alert('Login successful! Redirecting to Admin Dashboard.');
                navigate('/admin');
            } else {
                alert('Login successful! Welcome ' + (user.fullName || user.username));
                navigate('/');
            }

        } catch (error) {
            alert('Login failed: ' + error.message);
        } finally {
            setLoading(false);
            setUsername('');
            setPassword('');
        }
    };

    return (
        <div id="login-view">
            <div className="max-w-sm mx-auto custom-card mt-10">
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
                    <div className="mb-6 relative">
                        <label htmlFor="login-password" className="block text-gray-700 text-sm font-medium mb-2">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="login-password"
                                autoComplete="current-password"
                                className="custom-input pr-12"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-2"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
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
