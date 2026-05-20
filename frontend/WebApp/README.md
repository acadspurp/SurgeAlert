# SurgeAlert Web App

Vite + React SPA: public flood status, maps, registration/login, and admin dashboards (telemetry, residents, templates, reports, AI metrics).

## Run

```bash
cd frontend/WebApp
npm install
npm run dev
```

Build for production (e.g. Cloudflare Pages):

```bash
npm run build
npm run preview
```

## Configuration

Create `.env` or set hosting env vars:

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend API including `/api`, e.g. `https://your-backend.onrender.com/api` |
| `VITE_BACKEND_ORIGIN` | Optional origin fallback |
| `VITE_DEFAULT_PRODUCTION_BACKEND` | Fallback when API base unset |
| `VITE_DEMO_MODE` | `true` for demo/synthetic charts |

## Stack

- React, React Router, Tailwind CSS v4
- Chart.js, Leaflet, Zod
- REST via `src/services/api.js`; optional live MQTT hook (`useSensorMqtt.js`)

## Structure

```
src/
  pages/          Home, Maps, Login, Register, Admin/*
  services/       api.js, auth.js
  hooks/          sensor polling, MQTT, Manila clock
  config.js       API base URL resolution
```

Admin views read live sensor and system health from the backend; public pages show current alert level and forecasts backed by API data (not the old client-side water simulation).
