package com.surgealert.controller;

import com.surgealert.dto.AlertStatusDTO;
import com.surgealert.service.AlertService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public/alerts")
@CrossOrigin(origins = "*")
public class AlertController {
    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping("/status")
    public ResponseEntity<AlertStatusDTO> getCurrentAlertStatus() {
        AlertStatusDTO status = alertService.getCurrentAlertStatus();
        return ResponseEntity.ok(status);
    }
}