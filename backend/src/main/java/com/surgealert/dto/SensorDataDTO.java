package com.surgealert.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

public class SensorDataDTO {

    private Long id;
    private LocalDateTime timestamp;

    @JsonAlias("water_level")
    private Double waterLevelM;

    @JsonAlias({"sensor_flow_rate", "sensor_flow_rate_mps"})
    private Double sensorFlowRate;

    @JsonAlias({"image_flow_rate", "image_flow_rate_mps"})
    private Double imageFlowRate;

    /** Ultrasonic rise rate in m/h (column {@code rise_rate}). */
    @JsonAlias({"rise_rate", "rise_rate_mph"})
    private Double riseRate;

    private String currentAlertLevel;
    private Double predictedLevel;
    private String predictedAlertLevel;

    @JsonAlias("Tide_Height_m")
    private Double tideHeightM;
    @JsonAlias("QC_Rain_mm")
    private Double rainMm;
    @JsonAlias("Marulas_Rain_mm")
    private Double marulasRainMm;
    @JsonAlias("Pressure_hPa")
    private Double pressureHpa;
    @JsonAlias("Wind_Speed")
    private Double windSpeedKph;
    @JsonAlias("QC_Lag1")
    private Double qcLag1;
    @JsonAlias("QC_Lag2")
    private Double qcLag2;
    @JsonAlias("Mar_Lag1")
    private Double marLag1;
    @JsonAlias("Mar_Lag2")
    private Double marLag2;
    @JsonAlias("Mar_3hr_Sum")
    private Double mar3hrSum;
    @JsonAlias("Mar_6hr_Sum")
    private Double mar6hrSum;
    @JsonAlias("Mar_24hr_Sum")
    private Double mar24hrSum;
    @JsonAlias("Tide_Trend")
    private Double tideTrend;
    @JsonAlias("Press_Trend")
    private Double pressTrend;
    @JsonAlias("Wind_Sin")
    private Double windSin;
    @JsonAlias("Wind_Cos")
    private Double windCos;
    @JsonAlias("QC_3hr_Sum")
    private Double qc3hrSum;
    @JsonAlias("QC_6hr_Sum")
    private Double qc6hrSum;
    @JsonAlias("predicted_alert_class")
    private Integer predictedAlertClass;
    @JsonAlias("Soil_Moisture")
    private Double soilMoisturePct;
    @JsonAlias("is_simulated")
    private Boolean isSimulated;

    private String snapshotBase64;

    public SensorDataDTO() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public Double getWaterLevelM() { return waterLevelM; }
    public void setWaterLevelM(Double waterLevelM) { this.waterLevelM = waterLevelM; }

    public Double getSensorFlowRate() { return sensorFlowRate; }
    public void setSensorFlowRate(Double sensorFlowRate) { this.sensorFlowRate = sensorFlowRate; }

    public Double getImageFlowRate() { return imageFlowRate; }
    public void setImageFlowRate(Double imageFlowRate) { this.imageFlowRate = imageFlowRate; }

    public Double getRiseRate() { return riseRate; }
    public void setRiseRate(Double riseRate) { this.riseRate = riseRate; }

    public String getCurrentAlertLevel() { return currentAlertLevel; }
    public void setCurrentAlertLevel(String currentAlertLevel) { this.currentAlertLevel = currentAlertLevel; }

    public Double getPredictedLevel() { return predictedLevel; }
    public void setPredictedLevel(Double predictedLevel) { this.predictedLevel = predictedLevel; }

    public String getPredictedAlertLevel() { return predictedAlertLevel; }
    public void setPredictedAlertLevel(String predictedAlertLevel) { this.predictedAlertLevel = predictedAlertLevel; }

    public Double getTideHeightM() { return tideHeightM; }
    public void setTideHeightM(Double tideHeightM) { this.tideHeightM = tideHeightM; }

    public Double getRainMm() { return rainMm; }
    public void setRainMm(Double rainMm) { this.rainMm = rainMm; }

    public Double getPressureHpa() { return pressureHpa; }
    public void setPressureHpa(Double pressureHpa) { this.pressureHpa = pressureHpa; }

    public Double getWindSpeedKph() { return windSpeedKph; }
    public void setWindSpeedKph(Double windSpeedKph) { this.windSpeedKph = windSpeedKph; }

    public String getSnapshotBase64() { return snapshotBase64; }
    public void setSnapshotBase64(String snapshotBase64) { this.snapshotBase64 = snapshotBase64; }

    public Double getMarulasRainMm() { return marulasRainMm; }
    public void setMarulasRainMm(Double marulasRainMm) { this.marulasRainMm = marulasRainMm; }

    public Double getMar24hrSum() { return mar24hrSum; }
    public void setMar24hrSum(Double mar24hrSum) { this.mar24hrSum = mar24hrSum; }

    public Double getQcLag1() { return qcLag1; }
    public void setQcLag1(Double qcLag1) { this.qcLag1 = qcLag1; }

    public Double getQcLag2() { return qcLag2; }
    public void setQcLag2(Double qcLag2) { this.qcLag2 = qcLag2; }

    public Double getMarLag1() { return marLag1; }
    public void setMarLag1(Double marLag1) { this.marLag1 = marLag1; }

    public Double getMarLag2() { return marLag2; }
    public void setMarLag2(Double marLag2) { this.marLag2 = marLag2; }

    public Double getMar3hrSum() { return mar3hrSum; }
    public void setMar3hrSum(Double mar3hrSum) { this.mar3hrSum = mar3hrSum; }

    public Double getMar6hrSum() { return mar6hrSum; }
    public void setMar6hrSum(Double mar6hrSum) { this.mar6hrSum = mar6hrSum; }

    public Integer getPredictedAlertClass() { return predictedAlertClass; }
    public void setPredictedAlertClass(Integer predictedAlertClass) { this.predictedAlertClass = predictedAlertClass; }

    public Double getSoilMoisturePct() { return soilMoisturePct; }
    public void setSoilMoisturePct(Double soilMoisturePct) { this.soilMoisturePct = soilMoisturePct; }

    public Double getTideTrend() { return tideTrend; }
    public void setTideTrend(Double tideTrend) { this.tideTrend = tideTrend; }

    public Double getPressTrend() { return pressTrend; }
    public void setPressTrend(Double pressTrend) { this.pressTrend = pressTrend; }

    public Double getWindSin() { return windSin; }
    public void setWindSin(Double windSin) { this.windSin = windSin; }

    public Double getWindCos() { return windCos; }
    public void setWindCos(Double windCos) { this.windCos = windCos; }

    public Double getQc3hrSum() { return qc3hrSum; }
    public void setQc3hrSum(Double qc3hrSum) { this.qc3hrSum = qc3hrSum; }

    public Double getQc6hrSum() { return qc6hrSum; }
    public void setQc6hrSum(Double qc6hrSum) { this.qc6hrSum = qc6hrSum; }

    public Boolean getIsSimulated() { return isSimulated; }
    public void setIsSimulated(Boolean isSimulated) { this.isSimulated = isSimulated; }

    @JsonProperty("QC_Rain_mm") public Double getLegacyQcRain() { return rainMm; }
    @JsonProperty("Marulas_Rain_mm") public Double getLegacyMarRain() { return marulasRainMm; }
    @JsonProperty("Tide_Height_m") public Double getLegacyTide() { return tideHeightM; }
    @JsonProperty("Pressure_hPa") public Double getLegacyPress() { return pressureHpa; }
    @JsonProperty("Wind_Speed") public Double getLegacyWind() { return windSpeedKph; }
}
