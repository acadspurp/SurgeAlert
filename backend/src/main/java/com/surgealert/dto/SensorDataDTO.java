package com.surgealert.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

public class SensorDataDTO {

    private Long id;
    private LocalDateTime timestamp;

    // Raw Sensor Data
    @JsonProperty("water_level")
    private Double waterLevelM;
    private Double sensorFlowRateMps;
    
    // Computer Vision Data
    private Double imageFlowRateMps;
    @JsonProperty("rise_rate")
    private Double imageRiseRateMps;
    @JsonProperty("sensor_rise_rate")
    private Double sensorRiseRate;
    
    // Status
    private String currentAlertLevel;
    
    // --- NEW FIELDS FOR AI PREDICTION ---
    private Double predictedLevel;
    private String predictedAlertLevel;

    // --- ENVIRONMENTAL METRICS ---
    @JsonProperty("Tide_Height_m")
    private Double tideHeightM;

    @JsonProperty("QC_Rain_mm")
    private Double rainMm;
    
    @JsonProperty("Marulas_Rain_mm")
    private Double marulasRainMm;

    @JsonProperty("Pressure_hPa")
    private Double pressureHpa;

    @JsonProperty("Wind_Speed")
    private Double windSpeedKph;

    @JsonProperty("QC_Lag1")
    private Double qcLag1;
    @JsonProperty("QC_Lag2")
    private Double qcLag2;
    @JsonProperty("Mar_Lag1")
    private Double marLag1;
    @JsonProperty("Mar_Lag2")
    private Double marLag2;
    @JsonProperty("Mar_3hr_Sum")
    private Double mar3hrSum;
    @JsonProperty("Mar_6hr_Sum")
    private Double mar6hrSum;

    @JsonProperty("Mar_24hr_Sum")
    private Double mar24hrSum;

    @JsonProperty("Tide_Trend")
    private Double tideTrend;

    @JsonProperty("Press_Trend")
    private Double pressTrend;

    @JsonProperty("Wind_Sin")
    private Double windSin;
    @JsonProperty("Wind_Cos")
    private Double windCos;

    @JsonProperty("QC_3hr_Sum")
    private Double qc3hrSum;
    @JsonProperty("QC_6hr_Sum")
    private Double qc6hrSum;

    @JsonProperty("predicted_alert_class")
    private Integer predictedAlertClass;

    @JsonProperty("Soil_Moisture")
    private Double soilMoisturePct;

    @JsonProperty("is_simulated")
    private Boolean isSimulated;

    // Image
    private String snapshotBase64;

    public SensorDataDTO() {}

    // --- Getters and Setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public Double getWaterLevelM() { return waterLevelM; }
    public void setWaterLevelM(Double waterLevelM) { this.waterLevelM = waterLevelM; }

    public Double getSensorFlowRateMps() { return sensorFlowRateMps; }
    public void setSensorFlowRateMps(Double sensorFlowRateMps) { this.sensorFlowRateMps = sensorFlowRateMps; }

    public Double getImageFlowRateMps() { return imageFlowRateMps; }
    public void setImageFlowRateMps(Double imageFlowRateMps) { this.imageFlowRateMps = imageFlowRateMps; }

    public Double getImageRiseRateMps() { return imageRiseRateMps; }
    public void setImageRiseRateMps(Double imageRiseRateMps) { this.imageRiseRateMps = imageRiseRateMps; }

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

    public Double getSensorRiseRate() { return sensorRiseRate; }
    public void setSensorRiseRate(Double sensorRiseRate) { this.sensorRiseRate = sensorRiseRate; }

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
}