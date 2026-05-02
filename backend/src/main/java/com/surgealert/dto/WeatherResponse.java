package com.surgealert.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class WeatherResponse {
    // We only map the fields the frontend actually uses
    
    @JsonProperty("daily")
    private Daily daily;

    public Daily getDaily() { return daily; }
    public void setDaily(Daily daily) { this.daily = daily; }

    public static class Daily {
        @JsonProperty("time")
        private List<String> time;
        
        @JsonProperty("weathercode")
        private List<Integer> weathercode;
        
        @JsonProperty("temperature_2m_max")
        private List<Double> temperatureMax;
        
        @JsonProperty("temperature_2m_min")
        private List<Double> temperatureMin;

        // Getters and Setters
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