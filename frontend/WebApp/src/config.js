// Frontend should only expose non-sensitive config.
// Vite reads VITE_* keys from environment.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";
