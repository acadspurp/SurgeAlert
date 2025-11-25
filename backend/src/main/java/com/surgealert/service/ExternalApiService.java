package com.surgealert.service;

import com.surgealert.dto.TideResponse;
import com.surgealert.dto.WeatherResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class ExternalApiService {

    @Autowired
    private RestTemplate restTemplate;

    // Inject API Key from application.properties for security
    @Value("${worldtides.api.key}")
    private String tideApiKey;

    // Hardcoded coordinates for Marulas/Manila
    private final double LAT = 14.6773;
    private final double LON = 120.9842;
    
    // Coordinates specifically for Tide Station (Manila Harbor is closest reliable station)
    private final double TIDE_LAT = 14.576;
    private final double TIDE_LON = 120.963;

    public WeatherResponse fetchWeatherForecast() {
        // Open-Meteo does not require an API key
        String url = String.format(
            "https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia/Manila",
            LAT, LON
        );

        try {
            return restTemplate.getForObject(url, WeatherResponse.class);
        } catch (Exception e) {
            e.printStackTrace();
            return null; // Controller will handle the null
        }
    }

    public TideResponse fetchTideData() {
        // WorldTides requires an API key
        String url = String.format(
            "https://www.worldtides.info/api/v3?extremes&lat=%s&lon=%s&key=%s",
            TIDE_LAT, TIDE_LON, tideApiKey
        );

        try {
            return restTemplate.getForObject(url, TideResponse.class);
        } catch (Exception e) {
            e.printStackTrace();
            // Return an object with error message so frontend knows exactly what happened
            TideResponse errorResponse = new TideResponse();
            errorResponse.setError("Backend failed to fetch tides: " + e.getMessage());
            return errorResponse;
        }
    }
}