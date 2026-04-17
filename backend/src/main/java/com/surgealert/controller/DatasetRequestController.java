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
        if (!request.getEmail().endsWith("@pup.edu.ph") && !request.getEmail().endsWith("@up.edu.ph")) {
            return ResponseEntity.badRequest().body("Institutional email (@pup.edu.ph or @up.edu.ph) is required.");
        }
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
    public ResponseEntity<?> approveRequest(@PathVariable Long id) {
        return repository.findById(id).map(req -> {
            req.setStatus("APPROVED");
            repository.save(req);
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
