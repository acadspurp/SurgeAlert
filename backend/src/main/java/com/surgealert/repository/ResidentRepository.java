package com.surgealert.repository;

import com.surgealert.entity.Resident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ResidentRepository extends JpaRepository<Resident, Long> {
    Optional<Resident> findByPhoneNumber(String phoneNumber);
    List<Resident> findByIsActiveTrue();
    boolean existsByPhoneNumber(String phoneNumber);
}