package com.surgealert.dto;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Serialized into {@code weather_cache.json_response} — UI forecast plus ML hourly sources.
 */
public class WeatherCachePayload {

    private WeatherResponse forecast;
    private JsonNode qcHourly;
    private JsonNode marHourly;

    public WeatherResponse getForecast() {
        return forecast;
    }

    public void setForecast(WeatherResponse forecast) {
        this.forecast = forecast;
    }

    public JsonNode getQcHourly() {
        return qcHourly;
    }

    public void setQcHourly(JsonNode qcHourly) {
        this.qcHourly = qcHourly;
    }

    public JsonNode getMarHourly() {
        return marHourly;
    }

    public void setMarHourly(JsonNode marHourly) {
        this.marHourly = marHourly;
    }
}
