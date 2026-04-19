package com.surgealert.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.surgealert.dto.TideResponse;
import com.surgealert.dto.WeatherResponse;
import com.surgealert.entity.TideCache;
import com.surgealert.repository.TideCacheRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.Optional;

@Service
public class ExternalApiService {

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private TideCacheRepository tideCacheRepository;

    @Autowired
    private ObjectMapper objectMapper;

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
        LocalDate today = LocalDate.now();
        Optional<TideCache> cacheOpt = tideCacheRepository.findByFetchDate(today);

        if (cacheOpt.isPresent()) {
            try {
                return objectMapper.readValue(cacheOpt.get().getJsonResponse(), TideResponse.class);
            } catch (Exception e) {
                e.printStackTrace();
                // If parsing fails, fall through to fetch again
            }
        }

        // WorldTides requires an API key
        String url = String.format(
            "https://www.worldtides.info/api/v3?extremes&lat=%s&lon=%s&key=%s",
            TIDE_LAT, TIDE_LON, tideApiKey
        );

        try {
            TideResponse response = restTemplate.getForObject(url, TideResponse.class);
            if (response != null && response.getError() == null) {
                // Save to cache
                String json = objectMapper.writeValueAsString(response);
                TideCache newCache = new TideCache(today, json);
                tideCacheRepository.save(newCache);
            }
            return response;
        } catch (Exception e) {
            e.printStackTrace();
            TideResponse errorResponse = new TideResponse();
            errorResponse.setError("Unable to fetch tide data. Please try again later.");
            return errorResponse;
        }
    }
}