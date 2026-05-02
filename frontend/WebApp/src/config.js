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

function defaultApiBaseUrl() {
  // Prefer explicit build-time env (Cloudflare Pages → Variables). Must match Render's
  // "your-service.onrender.com" URL exactly — each Render service has a unique subdomain.
  const originFallback = (import.meta.env.VITE_BACKEND_ORIGIN || "").trim().replace(/\/+$/, "");
  if (originFallback) {
    return `${originFallback}/api`;
  }
  if (typeof window !== "undefined" && window.location.hostname.endsWith("pages.dev")) {
    return "https://surgealert-backend-fxqk.onrender.com/api";
  }
  return "http://localhost:8080/api";
}

// Normalize trailing slash so endpoint joins stay consistent.
export const API_BASE_URL = (envApiBaseUrl || defaultApiBaseUrl()).replace(/\/+$/, "");
