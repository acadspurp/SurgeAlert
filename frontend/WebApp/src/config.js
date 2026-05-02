// Frontend should only expose non-sensitive config.
// Vite reads VITE_* keys from environment.
const envApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();

function defaultApiBaseUrl() {
  // Cloudflare Pages production/preview fallback.
  if (typeof window !== "undefined" && window.location.hostname.endsWith("pages.dev")) {
    return "https://surgealert-backend.onrender.com/api";
  }
  // Local development fallback.
  return "http://localhost:8080/api";
}

// Normalize trailing slash so endpoint joins stay consistent.
export const API_BASE_URL = (envApiBaseUrl || defaultApiBaseUrl()).replace(/\/+$/, "");
