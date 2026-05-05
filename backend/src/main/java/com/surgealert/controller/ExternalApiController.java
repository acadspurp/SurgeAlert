package com.surgealert.controller;

import com.surgealert.dto.TideResponse;
import com.surgealert.dto.WeatherResponse;
import com.surgealert.service.ExternalApiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;

@RestController
@RequestMapping("/api/external")
@CrossOrigin(origins = "*") // Allow frontend to access this
public class ExternalApiController {

    private final ExternalApiService externalApiService;

    @Autowired
    public ExternalApiController(ExternalApiService externalApiService) {
        this.externalApiService = externalApiService;
    }

    @GetMapping("/weather")
    public ResponseEntity<WeatherResponse> getWeather() {
        WeatherResponse data = externalApiService.fetchWeatherForecast();
        if (data != null) {
            return ResponseEntity.ok(data);
        }
        return ResponseEntity.status(500).build();
    }

    @GetMapping("/tides")
    public ResponseEntity<TideResponse> getTides() {
        TideResponse data = externalApiService.fetchTideData();
        if (data != null) {
            return ResponseEntity.ok(data);
        }
        return ResponseEntity.status(500).build();
    }
}