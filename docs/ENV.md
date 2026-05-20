# SurgeAlert environment variables

Copy secrets into a root `.env` file (never commit). Edge also loads `EdgeSystem/.env` for Pi-only overrides.

## MQTT (must match on Pi, backend, and HiveMQ)

| Variable | Backend | Edge (Python) |
|----------|---------|---------------|
| Topic | `MQTT_TOPIC_SENSOR` | `MQTT_TOPIC_SENSOR` (default `surgealert/sensor-data`) |
| Broker URL | `MQTT_BROKER_URL` (`ssl://host:8883`) | `MQTT_BROKER` (hostname) + port 8883 |
| Username | `MQTT_BROKER_USERNAME` | `MQTT_USERNAME` |
| Password | `MQTT_BROKER_PASSWORD` | `MQTT_PASSWORD` |

## Backend (Render / local)

- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`
- `EDGE_API_KEY` — must match Pi `EDGE_API_KEY` (header `X-Edge-Key`)
- `SURGE_ENCRYPTION_SECRET` — 16+ characters for phone encryption
- `SURGE_CORS_ALLOWED_ORIGIN_PATTERNS` — comma-separated SPA origins (e.g. `https://your-pages.pages.dev`)

## Edge (Raspberry Pi)

- `BACKEND_IP` — Render hostname or `127.0.0.1`
- `BACKEND_PORT` — `8080` locally
- `USE_HARDWARE` — `true` for production Pi; `false` for lab (no cloud DB writes)
- `SENSOR_DEPTH_M`, threshold overrides as documented in `EdgeSystem/config/settings.py`

## Frontend (Cloudflare Pages / Vite)

- `VITE_API_BASE_URL` — full API base including `/api`, e.g. `https://your-backend.onrender.com/api`
- Optional: `VITE_BACKEND_ORIGIN`, `VITE_DEFAULT_PRODUCTION_BACKEND`

## Spring profiles

- Local dev: `SPRING_PROFILES_ACTIVE=dev` (verbose SQL)
- Production: `SPRING_PROFILES_ACTIVE=prod`
