// Frontend should only expose non-sensitive config.
// Vite reads VITE_* keys from environment.
let envApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_ORIGIN || "").trim();

function defaultApiBaseUrl() {
  // Cloudflare Pages production/preview fallback.
  if (typeof window !== "undefined" && window.location.hostname.endsWith("pages.dev")) {
    return "https://surgealert-backend-fxqk.onrender.com/api";
  }
  // Local development fallback.
  return "http://localhost:8080/api";
}

// Normalize trailing slash and ensure it ends with /api
let rawUrl = (envApiBaseUrl || defaultApiBaseUrl()).replace(/\/+$/, "");
if (!rawUrl.endsWith("/api")) {
    rawUrl += "/api";
}

export const API_BASE_URL = rawUrl;
