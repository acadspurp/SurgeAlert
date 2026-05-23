package com.surgealert.repository;

import com.surgealert.entity.WeatherCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface WeatherCacheRepository extends JpaRepository<WeatherCache, Long> {
    Optional<WeatherCache> findByFetchDate(LocalDate fetchDate);

    Optional<WeatherCache> findTopByOrderByFetchDateDesc();
}
