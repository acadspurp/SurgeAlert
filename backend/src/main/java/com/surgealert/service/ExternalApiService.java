package com.surgealert.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.surgealert.dto.TideResponse;
import com.surgealert.dto.WeatherCachePayload;
import com.surgealert.dto.WeatherResponse;
import com.surgealert.entity.TideCache;
import com.surgealert.entity.WeatherCache;
import com.surgealert.repository.TideCacheRepository;
import com.surgealert.repository.WeatherCacheRepository;
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
    private WeatherCacheRepository weatherCacheRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private static final ZoneId MANILA = ZoneId.of("Asia/Manila");

    // Inject API Key from application.properties for security
    @Value("${worldtides.api.key}")
    private String tideApiKey;

    @Value("${surgealert.tides.cache-max-age-days:2}")
    private long tideCacheMaxAgeDays;

    @Value("${surgealert.weather.cache-max-age-days:3}")
    private long weatherCacheMaxAgeDays;

    // Coordinates
    private final double MARULAS_LAT = 14.6773;
    private final double MARULAS_LON = 120.9842;
    private final double QC_LAT = 14.7153; // La Mesa Dam vicinity
    private final double QC_LON = 121.0667;
    
    // Tide Station (Manila Harbor)
    private final double TIDE_LAT = 14.576;
    private final double TIDE_LON = 120.963;

    public JsonNode fetchWeatherAt(double lat, double lon) {
        return fetchOpenMeteoHourly(lat, lon, 2);
    }

  /**
   * Dashboard forecast — served from {@code weather_cache} unless {@code forceRefresh}.
   */
    public WeatherResponse fetchWeatherForecast() {
        return fetchWeatherForecast(false);
    }

    public WeatherResponse fetchWeatherForecast(boolean forceRefresh) {
        if (!forceRefresh) {
            WeatherResponse cached = resolveCachedForecast(false);
            if (cached != null) {
                return cached;
            }
        }

        WeatherCachePayload refreshed = refreshWeatherCache();
        if (refreshed != null) {
            return refreshed.getForecast();
        }

        WeatherResponse stale = resolveCachedForecast(true);
        if (stale != null) {
            System.out.println(" [Weather] Live fetch failed — serving last cached forecast from DB.");
            return stale;
        }
        return null;
    }

    /** Prefer today's row, then recent cache; with {@code allowAnyAge}, return any displayable row. */
    private WeatherResponse resolveCachedForecast(boolean allowAnyAge) {
        LocalDate today = LocalDate.now(MANILA);
        try {
            Optional<WeatherCachePayload> todayPayload = readCachedPayload(today);
            if (todayPayload.isPresent() && hasUsableForecast(todayPayload.get())) {
                return todayPayload.get().getForecast();
            }

            Optional<WeatherCache> latestOpt = weatherCacheRepository.findTopByOrderByFetchDateDesc();
            if (latestOpt.isPresent()) {
                WeatherCache latest = latestOpt.get();
                Optional<WeatherCachePayload> parsed = parsePayload(latest.getJsonResponse());
                if (parsed.isPresent()) {
                    if (!allowAnyAge) {
                        long age = Math.abs(ChronoUnit.DAYS.between(latest.getFetchDate(), today));
                        if (age <= Math.max(0, weatherCacheMaxAgeDays)
                                && hasUsableForecast(parsed.get())) {
                            return parsed.get().getForecast();
                        }
                    } else if (hasDisplayableForecast(parsed.get())) {
                        return parsed.get().getForecast();
                    }
                }
            }
        } catch (Exception db) {
            System.err.println("Weather cache DB unavailable, skipping cache: " + db.getMessage());
        }
        return null;
    }

    /** Latest cached QC + Marulas hourly JSON for ML metrics (no live API). */
    public Optional<WeatherCachePayload> getLatestWeatherCachePayload() {
        LocalDate today = LocalDate.now(MANILA);
        try {
            Optional<WeatherCachePayload> todayPayload = readCachedPayload(today);
            if (todayPayload.isPresent() && hasUsableHourly(todayPayload.get())) {
                return todayPayload;
            }
            Optional<WeatherCache> latestOpt = weatherCacheRepository.findTopByOrderByFetchDateDesc();
            if (latestOpt.isEmpty()) {
                return Optional.empty();
            }
            WeatherCache latest = latestOpt.get();
            long age = Math.abs(ChronoUnit.DAYS.between(latest.getFetchDate(), today));
            if (age > Math.max(0, weatherCacheMaxAgeDays)) {
                return Optional.empty();
            }
            Optional<WeatherCachePayload> payload = parsePayload(latest.getJsonResponse());
            if (payload.isPresent() && hasUsableHourly(payload.get())) {
                return payload;
            }
        } catch (Exception e) {
            System.err.println("Weather cache read failed: " + e.getMessage());
        }
        return Optional.empty();
    }

    public boolean hasTodayWeatherCache() {
        LocalDate today = LocalDate.now(MANILA);
        try {
            Optional<WeatherCachePayload> cached = readCachedPayload(today);
            return cached.isPresent() && hasUsableForecast(cached.get()) && hasUsableHourly(cached.get());
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Fetches Open-Meteo (QC + Marulas), builds payload, saves to {@code weather_cache}.
     *
     * @return payload on success, or null when the network fetch fails
     */
    public WeatherCachePayload refreshWeatherCache() {
        try {
            JsonNode qcRoot = fetchOpenMeteoHourly(QC_LAT, QC_LON, 2);
            JsonNode marRoot = fetchOpenMeteoForecast(MARULAS_LAT, MARULAS_LON, 7);
            if (qcRoot == null || marRoot == null) {
                System.err.println("Weather refresh failed — Open-Meteo returned no data.");
                return null;
            }

            WeatherResponse forecast = mapMarulasForecast(marRoot);
            if (!hasUsableForecast(forecast)) {
                System.err.println("Weather refresh failed — forecast payload unusable.");
                return null;
            }

            WeatherCachePayload payload = new WeatherCachePayload();
            payload.setForecast(forecast);
            payload.setQcHourly(qcRoot);
            payload.setMarHourly(marRoot);

            LocalDate today = LocalDate.now(MANILA);
            String json = objectMapper.writeValueAsString(payload);
            weatherCacheRepository.save(new WeatherCache(today, json));
            System.out.println(" [Weather] Cache saved for " + today);
            return payload;
        } catch (Exception e) {
            System.err.println("Weather cache refresh failed: " + e.getMessage());
            return null;
        }
    }

    private JsonNode fetchOpenMeteoHourly(double lat, double lon, int forecastDays) {
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl("https://api.open-meteo.com/v1/forecast")
                    .queryParam("latitude", lat)
                    .queryParam("longitude", lon)
                    .queryParam("hourly", "precipitation,surface_pressure,wind_speed_10m,wind_direction_10m,soil_moisture_0_to_7cm")
                    .queryParam("timezone", "Asia/Manila")
                    .queryParam("forecast_days", forecastDays)
                    .build()
                    .toUri();
            return restTemplate.getForObject(uri, JsonNode.class);
        } catch (Exception e) {
            System.err.println("Weather hourly fetch failed for " + lat + "," + lon + ": " + e.getMessage());
            return null;
        }
    }

    private JsonNode fetchOpenMeteoForecast(double lat, double lon, int forecastDays) {
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl("https://api.open-meteo.com/v1/forecast")
                    .queryParam("latitude", lat)
                    .queryParam("longitude", lon)
                    .queryParam("hourly", "precipitation,surface_pressure,wind_speed_10m,wind_direction_10m")
                    .queryParam("daily", "weathercode,apparent_temperature_max,apparent_temperature_min")
                    .queryParam("timezone", "Asia/Manila")
                    .queryParam("forecast_days", forecastDays)
                    .build()
                    .toUri();
            return restTemplate.getForObject(uri, JsonNode.class);
        } catch (Exception e) {
            System.err.println("Weather forecast fetch failed for " + lat + "," + lon + ": " + e.getMessage());
            return null;
        }
    }

    private WeatherResponse mapMarulasForecast(JsonNode marData) {
        WeatherResponse response = new WeatherResponse();
        response.setLatitude(MARULAS_LAT);
        response.setLongitude(MARULAS_LON);

        int hour = LocalDateTime.now(MANILA).getHour();
        if (marData.has("hourly")) {
            JsonNode hourly = marData.get("hourly");
            if (hourly.has("precipitation")) {
                response.setRainMm(hourly.get("precipitation").get(hour).asDouble());
            }
            if (hourly.has("surface_pressure")) {
                response.setPressureHpa(hourly.get("surface_pressure").get(hour).asDouble());
            }
            if (hourly.has("wind_speed_10m")) {
                response.setWindSpeed(hourly.get("wind_speed_10m").get(hour).asDouble());
            }
        }

        if (marData.has("daily")) {
            JsonNode dailyNode = marData.get("daily");
            WeatherResponse.Daily daily = new WeatherResponse.Daily();

            List<String> times = new ArrayList<>();
            List<Integer> codes = new ArrayList<>();
            List<Double> maxTemps = new ArrayList<>();
            List<Double> minTemps = new ArrayList<>();

            dailyNode.get("time").forEach(t -> times.add(t.asText()));
            dailyNode.get("weathercode").forEach(c -> codes.add(c.asInt()));
            dailyNode.get("apparent_temperature_max").forEach(m -> maxTemps.add(m.asDouble()));
            dailyNode.get("apparent_temperature_min").forEach(m -> minTemps.add(m.asDouble()));

            daily.setTime(times);
            daily.setWeathercode(codes);
            daily.setTemperatureMax(maxTemps);
            daily.setTemperatureMin(minTemps);
            response.setDaily(daily);
        }

        return response;
    }

    private Optional<WeatherCachePayload> readCachedPayload(LocalDate fetchDate) {
        return weatherCacheRepository.findByFetchDate(fetchDate)
                .flatMap(row -> parsePayload(row.getJsonResponse()));
    }

    private Optional<WeatherCachePayload> parsePayload(String json) {
        if (json == null || json.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(json, WeatherCachePayload.class));
        } catch (Exception e) {
            System.err.println("Weather cache parse failed: " + e.getMessage());
            return Optional.empty();
        }
    }

    private boolean hasUsableForecast(WeatherCachePayload payload) {
        return payload != null && hasUsableForecast(payload.getForecast());
    }

    private boolean hasUsableForecast(WeatherResponse response) {
        if (!hasDisplayableForecast(response)) {
            return false;
        }
        List<String> times = response.getDaily().getTime();
        String today = LocalDate.now(MANILA).toString();
        boolean hasToday = times.stream().anyMatch(t -> t != null && t.startsWith(today));
        boolean hasFuture = times.stream().anyMatch(t -> t != null && t.compareTo(today) >= 0);
        return hasToday && hasFuture;
    }

    /** Any non-empty daily forecast — used when live API is down but DB still has data. */
    private boolean hasDisplayableForecast(WeatherCachePayload payload) {
        return payload != null && hasDisplayableForecast(payload.getForecast());
    }

    private boolean hasDisplayableForecast(WeatherResponse response) {
        if (response == null || response.getDaily() == null) {
            return false;
        }
        List<String> times = response.getDaily().getTime();
        List<Integer> codes = response.getDaily().getWeathercode();
        return times != null
                && !times.isEmpty()
                && codes != null
                && !codes.isEmpty()
                && codes.size() >= times.size();
    }

    private boolean hasUsableHourly(WeatherCachePayload payload) {
        if (payload == null || payload.getQcHourly() == null || payload.getMarHourly() == null) {
            return false;
        }
        JsonNode qcHourly = payload.getQcHourly().path("hourly");
        JsonNode marHourly = payload.getMarHourly().path("hourly");
        return qcHourly.has("precipitation")
                && marHourly.has("precipitation")
                && qcHourly.get("precipitation").size() > 0;
    }

    public TideResponse fetchTideData() {
        return fetchTideData(false);
    }

    public TideResponse fetchTideData(boolean forceRefresh) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Manila"));

        // Cache reads must not take down the endpoint if the DB is unavailable or the schema mismatches.
        if (!forceRefresh) {
            try {
                Optional<TideCache> cacheOpt = tideCacheRepository.findByFetchDate(today);

                if (cacheOpt.isPresent()) {
                    try {
                        TideResponse cachedResponse = objectMapper.readValue(cacheOpt.get().getJsonResponse(), TideResponse.class);
                        if (hasFutureHighAndLowExtremes(cachedResponse)) {
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
                            if (hasFutureHighAndLowExtremes(cachedResponse)) {
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
                    if (!hasFutureHighAndLowExtremes(worldTides)) {
                        // Retry with a longer horizon to recover missing next high/low events.
                        URI retryUri = UriComponentsBuilder.fromHttpUrl("https://www.worldtides.info/api/v3")
                                .queryParam("extremes", "")
                                .queryParam("heights", "")
                                .queryParam("resolution", "60")
                                .queryParam("days", "5")
                                .queryParam("lat", TIDE_LAT)
                                .queryParam("lon", TIDE_LON)
                                .queryParam("key", key)
                                .build()
                                .toUri();
                        TideResponse retry = restTemplate.getForObject(retryUri, TideResponse.class);
                        if (retry != null && retry.getError() == null && retry.getExtremes() != null && !retry.getExtremes().isEmpty()) {
                            worldTides = retry;
                        }
                    }
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
            List<TideResponse.TideHeight> heightsList = new ArrayList<>();

            for (int i = 0; i < times.size(); i++) {
                String timeStr = times.get(i).asText();
                double curHeight = heights.get(i).asDouble();
                long epochSec = ZonedDateTime.of(LocalDateTime.parse(timeStr, fmt), zone).toEpochSecond();

                // Add to hourly heights list
                TideResponse.TideHeight h = new TideResponse.TideHeight();
                h.setDt(epochSec);
                h.setHeight(curHeight);
                heightsList.add(h);

                // Calculate extremes (High/Low)
                if (i > 0 && i < times.size() - 1) {
                    double prev = heights.get(i - 1).asDouble();
                    double next = heights.get(i + 1).asDouble();
                    if (curHeight > prev && curHeight > next) {
                        TideResponse.TideExtreme e = new TideResponse.TideExtreme();
                        e.setDt(epochSec);
                        e.setType("High");
                        e.setHeight(curHeight);
                        e.setDate(timeStr);
                        extremes.add(e);
                    } else if (curHeight < prev && curHeight < next) {
                        TideResponse.TideExtreme e = new TideResponse.TideExtreme();
                        e.setDt(epochSec);
                        e.setType("Low");
                        e.setHeight(curHeight);
                        e.setDate(timeStr);
                        extremes.add(e);
                    }
                }
            }
            
            if (heightsList.isEmpty() && extremes.isEmpty()) {
                return null;
            }
            
            TideResponse r = new TideResponse();
            r.setExtremes(extremes);
            r.setHeights(heightsList);
            return r;
        } catch (Exception e) {
            System.err.println("Open-Meteo marine tide fallback failed: " + e.getMessage());
            return null;
        }
    }

    private boolean hasFutureHighAndLowExtremes(TideResponse response) {
        if (response == null || response.getExtremes() == null || response.getExtremes().isEmpty()) {
            return false;
        }
        long nowSeconds = System.currentTimeMillis() / 1000;
        boolean hasFutureHigh = false;
        boolean hasFutureLow = false;
        for (TideResponse.TideExtreme extreme : response.getExtremes()) {
            if (extreme.getDt() <= nowSeconds) continue;
            String type = extreme.getType() != null ? extreme.getType().trim().toLowerCase() : "";
            if ("high".equals(type) || "h".equals(type)) hasFutureHigh = true;
            if ("low".equals(type) || "l".equals(type)) hasFutureLow = true;
            if (hasFutureHigh && hasFutureLow) {
                return true;
            }
        }
        return false;
    }
}
