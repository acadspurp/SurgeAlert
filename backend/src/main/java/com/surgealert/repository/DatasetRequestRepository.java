package com.surgealert.repository;

import com.surgealert.entity.DatasetRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DatasetRequestRepository extends JpaRepository<DatasetRequest, Long> {
    List<DatasetRequest> findByStatusOrderByRequestDateDesc(String status);
}
