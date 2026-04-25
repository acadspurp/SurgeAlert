const USER_KEY = 'surge_user';
const SESSION_KEY = 'surge_session';

const encode = (value) => {
    if (!value) return '';
    const nonce = Math.floor(Math.random() * 1_000_000) + 111_111;
    const shifted = [...value].map((ch, idx) => ch.charCodeAt(0) + (nonce % (idx + 7)));
    return btoa(JSON.stringify({ n: nonce, d: shifted }));
};

const decode = (value) => {
    if (!value) return '';
    try {
        const parsed = JSON.parse(atob(value));
        const nonce = Number(parsed?.n || 0);
        const data = Array.isArray(parsed?.d) ? parsed.d : [];
        return data.map((code, idx) => String.fromCharCode(Number(code) - (nonce % (idx + 7)))).join('');
    } catch {
        return '';
    }
};

export const getUser = () => {
    const userStr = sessionStorage.getItem(USER_KEY);
    try {
        return userStr ? JSON.parse(userStr) : null;
    } catch {
        return null;
    }
};

export const setSession = ({ user, accessToken, refreshToken, accessExpiresAt }) => {
    if (user) {
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        at: encode(accessToken || ''),
        rt: encode(refreshToken || ''),
        exp: accessExpiresAt || ''
    }));
};

export const getAccessToken = () => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return '';
    try {
        return decode(JSON.parse(raw)?.at || '');
    } catch {
        return '';
    }
};

export const getRefreshToken = () => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return '';
    try {
        return decode(JSON.parse(raw)?.rt || '');
    } catch {
        return '';
    }
};

export const updateTokens = ({ accessToken, refreshToken, accessExpiresAt }) => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    let current = {};
    try {
        current = raw ? JSON.parse(raw) : {};
    } catch {
        current = {};
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        ...current,
        at: encode(accessToken || ''),
        rt: encode(refreshToken || ''),
        exp: accessExpiresAt || current.exp || ''
    }));
};

export const clearUser = () => {
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(SESSION_KEY);
};
