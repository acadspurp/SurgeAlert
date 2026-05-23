-- Fallback DDL for Render/Postgres when Hibernate has not created a table yet.
-- Safe to run on every startup (IF NOT EXISTS). Matches JPA entities in com.surgealert.entity.

CREATE TABLE IF NOT EXISTS sensor_data (
    id BIGSERIAL PRIMARY KEY,
    time TIMESTAMP NOT NULL,
    water_level DOUBLE PRECISION NOT NULL,
    sensor_flow_rate DOUBLE PRECISION NOT NULL,
    image_flow_rate DOUBLE PRECISION NOT NULL,
    fused_flow_rate DOUBLE PRECISION,
    rise_rate DOUBLE PRECISION NOT NULL,
    current_alert_level VARCHAR(32) NOT NULL,
    predicted_level DOUBLE PRECISION,
    predicted_alert_level VARCHAR(32),
    image_bytes BYTEA
);

CREATE TABLE IF NOT EXISTS weather_cache (
    id BIGSERIAL PRIMARY KEY,
    fetch_date DATE NOT NULL UNIQUE,
    json_response TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tide_cache (
    id BIGSERIAL PRIMARY KEY,
    fetch_date DATE NOT NULL UNIQUE,
    json_response TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weather_metrics (
    id BIGSERIAL PRIMARY KEY,
    time TIMESTAMP NOT NULL,
    qc_rain_mm DOUBLE PRECISION,
    marulas_rain_mm DOUBLE PRECISION,
    mar_24hr_sum DOUBLE PRECISION,
    pressure_hpa DOUBLE PRECISION,
    wind_speed DOUBLE PRECISION,
    wind_direction_deg DOUBLE PRECISION,
    soil_moisture DOUBLE PRECISION
);

-- Quoted identifiers match @Column names on MLFeaturesRealtime (mixed case).
CREATE TABLE IF NOT EXISTS ml_features_realtime (
    id BIGSERIAL PRIMARY KEY,
    time TIMESTAMP NOT NULL,
    "Hour" INTEGER,
    water_level DOUBLE PRECISION,
    rise_rate DOUBLE PRECISION,
    sensor_rise_rate DOUBLE PRECISION,
    mar_6hr_sum DOUBLE PRECISION,
    "Tide_Height_m" DOUBLE PRECISION,
    "Tide_Trend" DOUBLE PRECISION,
    "QC_Rain_mm" DOUBLE PRECISION,
    "QC_Rain_Lag1" DOUBLE PRECISION,
    "QC_Rain_Lag2" DOUBLE PRECISION,
    "QC_3hr_Sum" DOUBLE PRECISION,
    "QC_6hr_Sum" DOUBLE PRECISION,
    "Marulas_Rain_mm" DOUBLE PRECISION,
    "Mar_Rain_Lag1" DOUBLE PRECISION,
    "Mar_Rain_Lag2" DOUBLE PRECISION,
    "Mar_3hr_Sum" DOUBLE PRECISION,
    "Mar_24hr_Sum" DOUBLE PRECISION,
    "Pressure_hPa" DOUBLE PRECISION,
    "Press_Trend" DOUBLE PRECISION,
    "Wind_Speed" DOUBLE PRECISION,
    "Wind_Sin" DOUBLE PRECISION,
    "Wind_Cos" DOUBLE PRECISION,
    "Soil_Moisture" DOUBLE PRECISION,
    "Target_Alert_Class" INTEGER
);
