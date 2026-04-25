import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/api.js';
import { setSession } from '../services/auth.js';

export default function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
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
                    <div className="mb-6">
                        <label className="block text-gray-700 text-sm font-medium mb-2">Password</label>
                        <input
                            type="password"
                            id="login-password"
                            className="custom-input"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="custom-btn btn-blue w-full" disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}
