package com.surgealert.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "weather_cache")
public class WeatherCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private LocalDate fetchDate;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String jsonResponse;

    public WeatherCache() {
    }

    public WeatherCache(LocalDate fetchDate, String jsonResponse) {
        this.fetchDate = fetchDate;
        this.jsonResponse = jsonResponse;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDate getFetchDate() {
        return fetchDate;
    }

    public void setFetchDate(LocalDate fetchDate) {
        this.fetchDate = fetchDate;
    }

    public String getJsonResponse() {
        return jsonResponse;
    }

    public void setJsonResponse(String jsonResponse) {
        this.jsonResponse = jsonResponse;
    }
}
