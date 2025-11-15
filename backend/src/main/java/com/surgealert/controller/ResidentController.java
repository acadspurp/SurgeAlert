package com.surgealert.controller;

import com.surgealert.dto.ResidentRequest;
import com.surgealert.entity.Resident;
import com.surgealert.service.ResidentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/residents")
@CrossOrigin(origins = "*")
public class ResidentController {
    private final ResidentService residentService;

    public ResidentController(ResidentService residentService) {
        this.residentService = residentService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerResident(@RequestBody ResidentRequest request) {
        try {
            Resident resident = residentService.registerResident(request.getPhoneNumber());
            return ResponseEntity.status(HttpStatus.CREATED).body("Phone number registered successfully");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    @DeleteMapping("/{phoneNumber}")
    public ResponseEntity<?> unregisterResident(@PathVariable String phoneNumber) {
        try {
            residentService.unregisterResident(phoneNumber);
            return ResponseEntity.ok("Phone number unregistered successfully");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    @GetMapping("/active")
    public ResponseEntity<List<String>> getActivePhoneNumbers() {
        List<String> phoneNumbers = residentService.getAllActivePhoneNumbers();
        return ResponseEntity.ok(phoneNumbers);
    }
}