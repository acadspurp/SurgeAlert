package com.surgealert.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.surgealert.dto.TideResponse;
import com.surgealert.dto.WeatherResponse;
import com.surgealert.entity.TideCache;
import com.surgealert.repository.TideCacheRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
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

    @Value("${surgealert.tides.cache-max-age-days:2}")
    private long tideCacheMaxAgeDays;

    // Coordinates
    private final double MARULAS_LAT = 14.6773;
    private final double MARULAS_LON = 120.9842;
    private final double QC_LAT = 14.7153; // La Mesa Dam vicinity
    private final double QC_LON = 121.0667;
    
    // Tide Station (Manila Harbor)
    private final double TIDE_LAT = 14.576;
    private final double TIDE_LON = 120.963;

    public JsonNode fetchWeatherAt(double lat, double lon) {
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl("https://api.open-meteo.com/v1/forecast")
                    .queryParam("latitude", lat)
                    .queryParam("longitude", lon)
                    .queryParam("hourly", "precipitation,surface_pressure,wind_speed_10m,wind_direction_10m,soil_moisture_0_to_7cm")
                    .queryParam("timezone", "Asia/Manila")
                    .queryParam("forecast_days", 2)
                    .build()
                    .toUri();
            return restTemplate.getForObject(uri, JsonNode.class);
        } catch (Exception e) {
            System.err.println("Weather fetch failed for " + lat + "," + lon + ": " + e.getMessage());
            return null;
        }
    }

    public TideResponse fetchTideData() {
        LocalDate today = LocalDate.now();

        // Cache reads must not take down the endpoint if the DB is unavailable or the schema mismatches.
        try {
            Optional<TideCache> cacheOpt = tideCacheRepository.findByFetchDate(today);

            if (cacheOpt.isPresent()) {
                try {
                    TideResponse cachedResponse = objectMapper.readValue(cacheOpt.get().getJsonResponse(), TideResponse.class);
                    if (hasFutureExtremes(cachedResponse)) {
                        return cachedResponse;
                    }
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
                        TideResponse cachedResponse = objectMapper.readValue(latest.getJsonResponse(), TideResponse.class);
                        if (hasFutureExtremes(cachedResponse)) {
                            return cachedResponse;
                        }
                    } catch (Exception ignored) {
                        // fall through to network refresh
                    }
                }
            }
        } catch (Exception db) {
            System.err.println("Tide cache DB unavailable, skipping cache: " + db.getMessage());
        }

        String key = tideApiKey != null ? tideApiKey.trim() : "";
        TideResponse worldTides = null;

        if (!key.isEmpty()) {
            try {
                URI uri = UriComponentsBuilder.fromHttpUrl("https://www.worldtides.info/api/v3")
                        .queryParam("extremes", "")
                        .queryParam("heights", "")
                        .queryParam("resolution", "60")
                        .queryParam("days", "3")
                        .queryParam("lat", TIDE_LAT)
                        .queryParam("lon", TIDE_LON)
                        .queryParam("key", key)
                        .build()
                        .toUri();
                worldTides = restTemplate.getForObject(uri, TideResponse.class);
                if (worldTides != null
                        && worldTides.getError() == null
                        && worldTides.getExtremes() != null
                        && !worldTides.getExtremes().isEmpty()) {
                    try {
                        String json = objectMapper.writeValueAsString(worldTides);
                        tideCacheRepository.save(new TideCache(today, json));
                    } catch (Exception saveEx) {
                        System.err.println("Tide cache save failed (returning live data anyway): " + saveEx.getMessage());
                    }
                    return worldTides;
                }
            } catch (Exception e) {
                System.err.println("WorldTides request failed (will try marine fallback): " + e.getMessage());
            }
        } else {
            System.err.println("WORLDTIDES_API_KEY empty; using Open-Meteo marine tide model.");
        }

        TideResponse marine = fetchTidesFromMarineModel();
        if (marine != null) {
            return marine;
        }

        if (worldTides != null && worldTides.getError() != null && !worldTides.getError().isBlank()) {
            return worldTides;
        }

        TideResponse errorResponse = new TideResponse();
        if (key.isEmpty()) {
            errorResponse.setError("Tide API key is missing and the marine tide fallback failed.");
        } else {
            errorResponse.setError("WorldTides returned no usable data (often HTTP 403: invalid key, no credits, or IP blocked). Marine fallback also failed.");
        }
        return errorResponse;
    }

    /**
     * Open-Meteo marine model (no API key). Coarser than WorldTides; used when WorldTides is unavailable.
     */
    private TideResponse fetchTidesFromMarineModel() {
        String url = String.format(
                "https://marine-api.open-meteo.com/v1/marine?latitude=%s&longitude=%s&hourly=sea_level_height_msl&forecast_days=4&timezone=Asia/Manila",
                TIDE_LAT, TIDE_LON);
        try {
            JsonNode root = restTemplate.getForObject(url, JsonNode.class);
            if (root == null || !root.has("hourly")) {
                return null;
            }
            JsonNode hourly = root.get("hourly");
            JsonNode times = hourly.get("time");
            JsonNode heights = hourly.get("sea_level_height_msl");
            if (times == null || heights == null || !times.isArray() || times.size() < 3) {
                return null;
            }

            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");
            ZoneId zone = ZoneId.of("Asia/Manila");
            List<TideResponse.TideExtreme> extremes = new ArrayList<>();

            for (int i = 1; i < times.size() - 1; i++) {
                double prev = heights.get(i - 1).asDouble();
                double cur = heights.get(i).asDouble();
                double next = heights.get(i + 1).asDouble();
                String timeStr = times.get(i).asText();
                long epochSec = ZonedDateTime.of(LocalDateTime.parse(timeStr, fmt), zone).toEpochSecond();
                if (cur > prev && cur > next) {
                    TideResponse.TideExtreme e = new TideResponse.TideExtreme();
                    e.setDt(epochSec);
                    e.setType("High");
                    e.setHeight(cur);
                    e.setDate(timeStr);
                    extremes.add(e);
                } else if (cur < prev && cur < next) {
                    TideResponse.TideExtreme e = new TideResponse.TideExtreme();
                    e.setDt(epochSec);
                    e.setType("Low");
                    e.setHeight(cur);
                    e.setDate(timeStr);
                    extremes.add(e);
                }
            }
            if (extremes.isEmpty()) {
                return null;
            }
            TideResponse r = new TideResponse();
            r.setExtremes(extremes);
            return r;
        } catch (Exception e) {
            System.err.println("Open-Meteo marine tide fallback failed: " + e.getMessage());
            return null;
        }
    }

    private boolean hasFutureExtremes(TideResponse response) {
        if (response == null || response.getExtremes() == null || response.getExtremes().isEmpty()) {
            return false;
        }
        long nowSeconds = System.currentTimeMillis() / 1000;
        for (TideResponse.TideExtreme extreme : response.getExtremes()) {
            if (extreme.getDt() > nowSeconds) {
                return true;
            }
        }
        return false;
    }
}
