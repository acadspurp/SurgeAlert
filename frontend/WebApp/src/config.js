// Frontend should only expose non-sensitive config.
// Vite reads VITE_* keys from environment.

/** If VITE_API_BASE_URL is the backend origin without /api, Spring routes 403 (wrong chain). */
function ensureApiPathSuffix(url) {
  const u = url.trim().replace(/\/+$/, "");
  if (!u) return "";
  if (/\/api(\/|$)/.test(u)) return u;
  return `${u}/api`;
}

const envApiBaseUrl = ensureApiPathSuffix(import.meta.env.VITE_API_BASE_URL || "");

const PRODUCTION_URL = "https://surgealert-backend-fxqk.onrender.com"; // <-- PUT YOUR BACKEND LINK HERE

function defaultApiBaseUrl() {
  const originFallback = (import.meta.env.VITE_BACKEND_ORIGIN || "").trim().replace(/\/+$/, "");
  if (originFallback) {
    return `${originFallback}/api`;
  }

  // If running locally, use localhost. If on production, use the PRODUCTION_URL
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8080/api";
    }
  }

  return `${PRODUCTION_URL}/api`;
}

// Normalize trailing slash so endpoint joins stay consistent.
export const API_BASE_URL = (envApiBaseUrl || defaultApiBaseUrl()).replace(/\/+$/, "");
