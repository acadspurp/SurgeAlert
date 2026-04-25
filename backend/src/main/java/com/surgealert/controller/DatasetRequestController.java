package com.surgealert.controller;

import com.surgealert.entity.DatasetRequest;
import com.surgealert.repository.DatasetRequestRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class DatasetRequestController {

    private final DatasetRequestRepository repository;

    public DatasetRequestController(DatasetRequestRepository repository) {
        this.repository = repository;
    }

    // Public endpoint for submitting a request
    @PostMapping("/public/dataset/request")
    public ResponseEntity<?> submitRequest(@RequestBody DatasetRequest request) {
        request.setStatus("PENDING");
        DatasetRequest saved = repository.save(request);
        return ResponseEntity.ok(saved);
    }

    // Admin endpoint to view pending requests
    @GetMapping("/admin/datasets/pending")
    public ResponseEntity<List<DatasetRequest>> getPendingRequests() {
        return ResponseEntity.ok(repository.findByStatusOrderByRequestDateDesc("PENDING"));
    }

    // Admin endpoint to approve a request
    @PutMapping("/admin/datasets/{id}/approve")
    public ResponseEntity<?> approveRequest(@PathVariable("id") Long id) {
        return repository.findById(id).map(req -> {
            req.setStatus("APPROVED");
            repository.save(req);
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }

    // Admin endpoint to get all requests for the new status column UI
    @GetMapping("/admin/datasets")
    public ResponseEntity<List<DatasetRequest>> getAllRequests() {
        return ResponseEntity.ok(repository.findAll());
    }

    // Admin endpoint to update the status via dropdown
    @PutMapping("/admin/datasets/{id}/status")
    public ResponseEntity<?> updateRequestStatus(@PathVariable("id") Long id, @RequestParam("status") String status) {
        return repository.findById(id).map(req -> {
            req.setStatus(status.toUpperCase());
            repository.save(req);
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
