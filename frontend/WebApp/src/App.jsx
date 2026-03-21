import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Maps from './pages/Maps.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import About from './pages/About.jsx';
import Admin from './pages/Admin.jsx';

function AppLayout() {
    const location = useLocation();
    const isAdminPage = location.pathname === '/admin';

    // Admin page has its own layout (sidebar, no header/footer)
    if (isAdminPage) {
        return <Admin />;
    }

    return (
        <div id="app" className="flex flex-col min-h-screen">
            <Header />
            <main id="main-content" className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/maps" element={<Maps />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/about" element={<About />} />
                </Routes>
            </main>
            <Footer />
        </div>
    );
}

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<AppLayout />} />
            </Routes>
        </Router>
    );
}
