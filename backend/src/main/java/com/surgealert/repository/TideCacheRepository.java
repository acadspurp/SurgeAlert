package com.surgealert.repository;

import com.surgealert.entity.TideCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface TideCacheRepository extends JpaRepository<TideCache, Long> {
    Optional<TideCache> findByFetchDate(LocalDate fetchDate);
    Optional<TideCache> findTopByOrderByFetchDateDesc();
}
