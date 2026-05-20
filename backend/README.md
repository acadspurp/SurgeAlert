# SurgeAlert Backend

Spring Boot 3 API: ingest edge telemetry (MQTT), store sensor data in Postgres, serve the React app, sync config to the Pi, dispatch alert SMS.

## Run locally

**Requires:** Java 17+, Maven, Postgres (or Render JDBC URL in env).

```bash
cd backend
mvn spring-boot:run
```

Default port `8080`. Env is read from repo-root `.env` (Spring maps `SPRING_DATASOURCE_*`, `EDGE_API_KEY`, `MQTT_*`, etc.).

## Main responsibilities

| Area | Notes |
|------|--------|
| **MQTT** | Subscribes `mqtt.topic.sensor` (default `sensor/data`); upserts 5-min grid rows |
| **Edge sync** | `/api/edge/sync/*` — residents, templates, ML features, model binary, snapshots (requires `X-Edge-Key`) |
| **SMS** | Online alerts via MQTT `surgealert/outbound/sms` to the Pi GSM module; Semaphore for OTP |
| **Environmental data** | Tide/weather ML features via scheduler (not from edge MQTT) |

Simulated edge payloads (`is_simulated: true`) are accepted on MQTT but **not** saved to `sensor_data`.

## Key environment variables

| Variable | Purpose |
|----------|---------|
| `SPRING_DATASOURCE_URL`, `USERNAME`, `PASSWORD` | Postgres |
| `EDGE_API_KEY` | Must match Pi; blank → all edge sync returns 403 |
| `MQTT_BROKER_URL` | e.g. `ssl://….hivemq.cloud:8883` |
| `MQTT_BROKER_USERNAME`, `MQTT_BROKER_PASSWORD` | Broker auth |
| `MQTT_TOPIC_SENSOR` | Default `sensor/data` |
| `surgealert.sensor.depth-m` | Sensor height (mirror Pi `SENSOR_DEPTH_M`) |

Thresholds: `surgealert.thresholds.yellow/orange/red` in `application.properties`.

## Docker

```bash
docker build -t surgealert-backend .
```

JAR is built with `mvn clean package -DskipTests` inside the image.

## ML training (server)

`MlTrainingService` still references the removed `retrain_from_postgres.py`. For new models, run `EdgeSystem`’s `python -m ml_model.train_model` and register the artifact via `MlModelRegistryService` / edge sync endpoint until Sunday automation is wired to `train_model.py`.
