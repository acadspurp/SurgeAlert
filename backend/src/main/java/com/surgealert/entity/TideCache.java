package com.surgealert.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "tide_cache")
public class TideCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private LocalDate fetchDate;

    // Use TEXT or LONGTEXT for JSON response depending on DB dialect. Column definition helps.
    @Column(columnDefinition = "TEXT", nullable = false)
    private String jsonResponse;

    public TideCache() {
    }

    public TideCache(LocalDate fetchDate, String jsonResponse) {
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
