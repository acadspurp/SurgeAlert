package com.surgealert.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class WeatherResponse {
    // We only map the fields the frontend actually uses
    
    private Double latitude;
    private Double longitude;
    private Double rainMm;
    private Double pressureHpa;
    private Double windSpeed;

    @JsonProperty("daily")
    private Daily daily;

    // Getters and Setters
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public Double getRainMm() { return rainMm; }
    public void setRainMm(Double rainMm) { this.rainMm = rainMm; }
    public Double getPressureHpa() { return pressureHpa; }
    public void setPressureHpa(Double pressureHpa) { this.pressureHpa = pressureHpa; }
    public Double getWindSpeed() { return windSpeed; }
    public void setWindSpeed(Double windSpeed) { this.windSpeed = windSpeed; }
    public Daily getDaily() { return daily; }
    public void setDaily(Daily daily) { this.daily = daily; }

    public static class Daily {
        @JsonProperty("time")
        private List<String> time;
        @JsonProperty("weathercode")
        private List<Integer> weathercode;
        @JsonProperty("apparent_temperature_max")
        private List<Double> temperatureMax;
        @JsonProperty("apparent_temperature_min")
        private List<Double> temperatureMin;

        public List<String> getTime() { return time; }
        public void setTime(List<String> time) { this.time = time; }
        public List<Integer> getWeathercode() { return weathercode; }
        public void setWeathercode(List<Integer> weathercode) { this.weathercode = weathercode; }
        public List<Double> getTemperatureMax() { return temperatureMax; }
        public void setTemperatureMax(List<Double> temperatureMax) { this.temperatureMax = temperatureMax; }
        public List<Double> getTemperatureMin() { return temperatureMin; }
        public void setTemperatureMin(List<Double> temperatureMin) { this.temperatureMin = temperatureMin; }
    }
}