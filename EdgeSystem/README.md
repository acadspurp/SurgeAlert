# SurgeAlert EdgeSystem

On-site Python runtime for Raspberry Pi: ultrasonic water level, radar flow, camera optical flow, alert bands (GREEN/YELLOW/ORANGE/RED), optional XGBoost +1h prediction, MQTT telemetry, HTTPS snapshots, offline GSM SMS.

## Run

```bash
cd EdgeSystem
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m system_main.main_loop
```

Stop with `Ctrl+C`. Console prints a dashboard each 5-minute cycle (sleep 4m30s → gather 30s).

## Configuration

Loads `../.env` then `EdgeSystem/.env` (Pi overrides win).

**Deployment values** (thresholds, pool scale, timing, sim sensors): edit `config/deployment_profiles.py`.  
**Mode switch:** `ENVIRONMENT_MODE` in `config/settings.py` (`"RIVER"` or `"POOL"`).

| Setting | Where |
|---------|--------|
| `ENVIRONMENT_MODE` | `config/settings.py` — `RIVER` or `POOL` |
| Pool scaling | `deployment_profiles.py` — `water_level_scale_factor`, `rise_rate_scale_factor`, `flow_scale_factor` |
| `BACKEND_IP` | Render URL or `127.0.0.1` |
| `EDGE_API_KEY` | Must match backend (`X-Edge-Key`) |
| `MQTT_BROKER`, `MQTT_USERNAME`, `MQTT_PASSWORD` | HiveMQ Cloud hostname + creds |
| `MQTT_TOPIC_SENSOR` | Default `sensor/data` |
| `USE_HARDWARE` | Omit or `true` on Pi; `false` = simulated sensors, cloud skips DB ingest |

Pool test: set `ENVIRONMENT_MODE = "POOL"` in `settings.py`, tune `POOL` in `deployment_profiles.py`, restart.  
River deploy: `ENVIRONMENT_MODE = "RIVER"` in `settings.py`; mirror `sensor_height_m` with backend `surgealert.sensor.depth-m`.

Port **8883** and TLS are fixed in code for non-local brokers (HiveMQ).

## Data flow

1. Sensors + camera → fusion, rise rate, thresholds (+ ML if model loaded).
2. SQLite `database/surgealert.db` (offline cache).
3. MQTT `sensor/data` → backend Postgres.
4. HTTPS `/api/edge/sync/snapshot` for images (not on MQTT).
5. If backend unreachable: GSM SMS on alert **level change** (residents/templates from `/api/edge/sync/all`).

## Machine learning

- **Runtime model:** `ml_model/trained_models/flood_prediction_model.joblib` (classifier + regressor bundle).
- **Train locally:** `python -m ml_model.train_model`
- **Pi update when online:** `GET /api/edge/sync/model` when backend publishes a new version.

Scheduled Sunday retraining from Postgres is planned later; use `train_model.py` for new artifacts.

## Hardware (Pi)

- Ultrasonic: GPIO (see `config/settings.py`)
- Radar: `/dev/ttyUSB0`
- GSM (offline SMS): `/dev/ttyUSB2` (`GSM_PORT` in `config/settings.py`)
- Camera: OpenCV index `0` when `USE_HARDWARE=true`

Terminal tags: `[Ultrasonic]`, `[Radar]`, `[Camera]`, `[GSM]`, `[MQTT]` — **CONNECTION** = wiring/port/USB, **PARSER** = data format, **INVALID** = bad reading held to last good level.

## Auto-start on Pi

See `deploy/README.md` and `deploy/surgealert-edge.service` (systemd).

## Layout

```
system_main/     main_loop, MQTT, sync, SQLite, SMS
hardware/        ultrasonic, radar, camera drivers
processing/      water level, CV flow, fusion, rise rate
alert_logic/     thresholds + flow escalation
ml_model/        train_model, level_predictor, trained_models/
config/          settings.py, deployment_profiles.py
```
