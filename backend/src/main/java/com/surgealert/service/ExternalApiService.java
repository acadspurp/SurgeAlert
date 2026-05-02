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

    // Hardcoded coordinates for Marulas/Manila
    private final double LAT = 14.6773;
    private final double LON = 120.9842;
    
    // Coordinates specifically for Tide Station (Manila Harbor is closest reliable station)
    private final double TIDE_LAT = 14.576;
    private final double TIDE_LON = 120.963;

    public WeatherResponse fetchWeatherForecast() {
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl("https://api.open-meteo.com/v1/forecast")
                    .queryParam("latitude", LAT)
                    .queryParam("longitude", LON)
                    .queryParam("daily", "weathercode,apparent_temperature_max,apparent_temperature_min")
                    .queryParam("timezone", "Asia/Manila")
                    .build()
                    .toUri();
            return restTemplate.getForObject(uri, WeatherResponse.class);
        } catch (Exception e) {
            e.printStackTrace();
            return null; // Controller will handle the null
        }
    }

    public TideResponse fetchTideData() {
        LocalDate today = LocalDate.now();

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
        TideResponse worldTides = null;

        if (!key.isEmpty()) {
            try {
                URI uri = UriComponentsBuilder.fromHttpUrl("https://www.worldtides.info/api/v3")
                        .queryParam("extremes", "")
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
}
