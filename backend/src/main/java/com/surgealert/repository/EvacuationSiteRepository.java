package com.surgealert.repository;

import com.surgealert.entity.EvacuationSite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EvacuationSiteRepository extends JpaRepository<EvacuationSite, Long> {
    List<EvacuationSite> findByIsActiveTrue();
}