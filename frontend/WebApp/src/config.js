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

const DEFAULT_PRODUCTION_BACKEND =
  (import.meta.env.VITE_DEFAULT_PRODUCTION_BACKEND || "https://surgealert-backend-fxqk.onrender.com")
    .trim()
    .replace(/\/+$/, "");

function defaultApiBaseUrl() {
  const originFallback = (import.meta.env.VITE_BACKEND_ORIGIN || "").trim().replace(/\/+$/, "");
  if (originFallback) {
    return `${originFallback}/api`;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8080/api";
    }
    if (DEFAULT_PRODUCTION_BACKEND) {
      return `${DEFAULT_PRODUCTION_BACKEND}/api`;
    }
  }

  return "http://localhost:8080/api";
}

// Normalize trailing slash so endpoint joins stay consistent.
export const API_BASE_URL = (envApiBaseUrl || defaultApiBaseUrl()).replace(/\/+$/, "");
