// Session Management - same as original auth.js

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
