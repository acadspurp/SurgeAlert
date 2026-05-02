import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getUser, clearUser } from '../services/auth.js';

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const user = getUser();

    const handleLogout = () => {
        clearUser();
        navigate('/');
        window.location.reload();
    };

    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    const handleNavClick = (path) => {
        navigate(path);
        setMobileMenuOpen(false);
    };

    return (
        <header className="bg-[#0f172a] shadow-md sticky top-0 z-[9999] border-b border-gray-800">
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <div className="flex items-center gap-3 cursor-pointer header-logo" onClick={() => handleNavClick('/')}>
                        <img src="/src/assets/logo.png" alt="SurgeAlert Logo" className="w-16 h-16 object-contain" />
                        <span className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-300 transition-opacity duration-200">SurgeAlert</span>
                    </div>
                    {/* Desktop Menu */}
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            <a href="#" onClick={(e) => { e.preventDefault(); handleNavClick('/'); }} className={`px-3 py-2 ${location.pathname === '/' ? 'text-cyan-400 font-black border-b-2 border-cyan-400' : 'text-gray-300 hover:text-white font-medium'}`}>Home</a>
                            <a href="#" onClick={(e) => { e.preventDefault(); handleNavClick('/maps'); }} className={`px-3 py-2 ${location.pathname === '/maps' ? 'text-cyan-400 font-black border-b-2 border-cyan-400' : 'text-gray-300 hover:text-white font-medium'}`}>Maps</a>
                            <a href="#" onClick={(e) => { e.preventDefault(); handleNavClick('/about'); }} className={`px-3 py-2 ${location.pathname === '/about' ? 'text-cyan-400 font-black border-b-2 border-cyan-400' : 'text-gray-300 hover:text-white font-medium'}`}>About</a>
                        </div>
                    </div>
                    {/* Login/Logout */}
                    <div className="hidden md:block">
                        {user ? (
                            <button onClick={handleLogout} id="logout-btn" className="custom-btn btn-red">Logout</button>
                        ) : (
                            <button onClick={() => handleNavClick('/login')} id="login-btn" className="custom-btn btn-blue">Login</button>
                        )}
                    </div>
                    {/* Mobile Button */}
                    <div className="-mr-2 flex md:hidden">
                        <button type="button" id="mobile-menu-button" onClick={toggleMobileMenu} className="bg-gray-200 p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700">
                            <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                        </button>
                    </div>
                </div>
            </nav>
            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden" id="mobile-menu">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-navy-900">
                        <a href="#" onClick={(e) => { e.preventDefault(); handleNavClick('/'); }} className={`block px-3 py-2 text-white ${location.pathname === '/' ? 'bg-cyan-600 font-bold rounded-md' : 'hover:bg-blue-500'}`}>Home</a>
                        <a href="#" onClick={(e) => { e.preventDefault(); handleNavClick('/maps'); }} className={`block px-3 py-2 text-white ${location.pathname === '/maps' ? 'bg-cyan-600 font-bold rounded-md' : 'hover:bg-blue-500'}`}>Maps</a>
                        <a href="#" onClick={(e) => { e.preventDefault(); handleNavClick('/about'); }} className={`block px-3 py-2 text-white ${location.pathname === '/about' ? 'bg-cyan-600 font-bold rounded-md' : 'hover:bg-blue-500'}`}>About</a>
                        {user ? (
                            <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }} id="mobile-logout-btn" className="block px-3 py-2 text-white hover:bg-red-500">Logout</a>
                        ) : (
                            <a href="#" onClick={(e) => { e.preventDefault(); handleNavClick('/login'); }} id="mobile-login-btn" className="block px-3 py-2 text-white hover:bg-blue-500">Login</a>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
