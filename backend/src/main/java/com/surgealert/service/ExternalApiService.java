package com.surgealert.service;

<<<<<<< HEAD
=======
import com.fasterxml.jackson.databind.ObjectMapper;
>>>>>>> parent of 464abb32 (tide weather resilience: marine fallback and clearer errors)
import com.surgealert.dto.TideResponse;
import com.surgealert.dto.WeatherResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

<<<<<<< HEAD
<<<<<<< HEAD
=======
=======
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
>>>>>>> parent of 464abb32 (tide weather resilience: marine fallback and clearer errors)
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

>>>>>>> parent of 61be1583 (fix outbound weather/tides from Render)
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
    private final double TIDE_LAT = 14.576;
    private final double TIDE_LON = 120.963;

    public WeatherResponse fetchWeatherForecast() {
<<<<<<< HEAD
        String url = String.format(
            "https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia/Manila",
            LAT, LON
        );
=======
        // Open-Meteo does not require an API key
        String url = String.format(
            "https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&daily=weathercode,apparent_temperature_max,apparent_temperature_min&timezone=Asia/Manila",
            LAT, LON
        );

>>>>>>> parent of 464abb32 (tide weather resilience: marine fallback and clearer errors)
        try {
            return restTemplate.getForObject(url, WeatherResponse.class);
        } catch (Exception e) {
            e.printStackTrace();
            return null; // Or handle error gracefully
        }
    }

    public TideResponse fetchTideData() {
<<<<<<< HEAD
=======
        LocalDate today = LocalDate.now();
        Optional<TideCache> cacheOpt = tideCacheRepository.findByFetchDate(today);

<<<<<<< HEAD
        if (cacheOpt.isPresent()) {
            try {
                return objectMapper.readValue(cacheOpt.get().getJsonResponse(), TideResponse.class);
            } catch (Exception e) {
                e.printStackTrace();
                // If parsing fails, fall through to fetch again
            }
        }

        // Reuse the latest cache when still fresh (API typically returns multi-day tide windows).
        Optional<TideCache> latestOpt = tideCacheRepository.findTopByOrderByFetchDateDesc();
        if (latestOpt.isPresent()) {
            TideCache latest = latestOpt.get();
            long age = Math.abs(ChronoUnit.DAYS.between(latest.getFetchDate(), today));
            if (age <= Math.max(0, tideCacheMaxAgeDays)) {
                try {
                    return objectMapper.readValue(latest.getJsonResponse(), TideResponse.class);
                } catch (Exception ignored) {
                    // fall through to network refresh
                }
            }
        }

        if (tideApiKey == null || tideApiKey.trim().isEmpty()) {
            System.err.println("WARNING: WORLDTIDES_API_KEY is missing in .env! Tide data will not be fetched.");
            TideResponse errorResponse = new TideResponse();
            errorResponse.setError("Tide API Key is missing. Check your .env file.");
            return errorResponse;
        }

        // WorldTides requires an API key
>>>>>>> parent of 61be1583 (fix outbound weather/tides from Render)
        String url = String.format(
            "https://www.worldtides.info/api/v3?extremes&lat=%s&lon=%s&key=%s",
            TIDE_LAT, TIDE_LON, tideApiKey
        );
        try {
<<<<<<< HEAD
            return restTemplate.getForObject(url, TideResponse.class);
        } catch (Exception e) {
            e.printStackTrace();
            // Return an object with error message so frontend knows
=======
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
            // Return an object with error message so frontend knows exactly what happened
>>>>>>> parent of 61be1583 (fix outbound weather/tides from Render)
            TideResponse errorResponse = new TideResponse();
            errorResponse.setError("Backend failed to fetch tides");
=======
        // Cache reads must not take down the endpoint if the DB is unavailable or the schema mismatches.
        try {
            Optional<TideCache> cacheOpt = tideCacheRepository.findByFetchDate(today);

            if (cacheOpt.isPresent()) {
                try {
                    return objectMapper.readValue(cacheOpt.get().getJsonResponse(), TideResponse.class);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }

            Optional<TideCache> latestOpt = tideCacheRepository.findTopByOrderByFetchDateDesc();
            if (latestOpt.isPresent()) {
                TideCache latest = latestOpt.get();
                long age = Math.abs(ChronoUnit.DAYS.between(latest.getFetchDate(), today));
                if (age <= Math.max(0, tideCacheMaxAgeDays)) {
                    try {
                        return objectMapper.readValue(latest.getJsonResponse(), TideResponse.class);
                    } catch (Exception ignored) {
                        // fall through to network refresh
                    }
                }
            }
        } catch (Exception db) {
            System.err.println("Tide cache DB unavailable, skipping cache: " + db.getMessage());
        }

        String key = tideApiKey != null ? tideApiKey.trim() : "";
        if (key.isEmpty()) {
            System.err.println("WARNING: WORLDTIDES_API_KEY is missing in .env! Tide data will not be fetched.");
            TideResponse errorResponse = new TideResponse();
            errorResponse.setError("Tide API Key is missing. Check your .env file.");
            return errorResponse;
        }

        String keyEncoded = URLEncoder.encode(key, StandardCharsets.UTF_8);
        String url = String.format(
            "https://www.worldtides.info/api/v3?extremes&lat=%s&lon=%s&key=%s",
            TIDE_LAT, TIDE_LON, keyEncoded
        );

        try {
            TideResponse response = restTemplate.getForObject(url, TideResponse.class);
            if (response != null && response.getError() == null) {
                try {
                    String json = objectMapper.writeValueAsString(response);
                    tideCacheRepository.save(new TideCache(today, json));
                } catch (Exception saveEx) {
                    System.err.println("Tide cache save failed (returning live data anyway): " + saveEx.getMessage());
                }
            }
            return response;
        } catch (Exception e) {
            e.printStackTrace();
            TideResponse errorResponse = new TideResponse();
            errorResponse.setError("Backend failed to fetch tides: " + e.getMessage());
>>>>>>> parent of 464abb32 (tide weather resilience: marine fallback and clearer errors)
            return errorResponse;
        }
    }
}