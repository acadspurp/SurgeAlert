# SurgeAlert

Flood monitoring and early warning for the Tullahan River (Barangay Marulas, Valenzuela). Edge sensors and CV on a Raspberry Pi, Spring API + Postgres, React dashboard.

## Repository layout

| Path | Role |
|------|------|
| [`EdgeSystem/`](EdgeSystem/) | Python edge runtime (Pi): sensors, alerts, MQTT, offline GSM |
| [`backend/`](backend/) | Spring Boot API, MQTT ingest, SMS dispatch, edge sync |
| [`frontend/WebApp/`](frontend/WebApp/) | Vite + React public site and admin UI |

## Quick start (local dev)

1. Copy env secrets into repo-root `.env` (see each component README for required keys).
2. **Backend:** `cd backend` → `mvn spring-boot:run`
3. **Frontend:** `cd frontend/WebApp` → `npm install` → `npm run dev`
4. **Edge (simulated):** `cd EdgeSystem` → `pip install -r requirements.txt` → `python -m system_main.main_loop`  
   Set `USE_HARDWARE=false` in `.env` only for lab mode (no Postgres writes for simulated rows).

## Production notes

- MQTT: HiveMQ Cloud, **MQTTS port 8883**, topic `sensor/data` (must match on Pi, backend, broker).
- Pi and backend must share the same `EDGE_API_KEY` (`X-Edge-Key` on `/api/edge/sync/*`).
- ML artifact: `EdgeSystem/ml_model/trained_models/flood_prediction_model.joblib` (train with `python -m ml_model.train_model`).

Component details: [EdgeSystem/README.md](EdgeSystem/README.md) · [backend/README.md](backend/README.md) · [frontend/WebApp/README.md](frontend/WebApp/README.md)
