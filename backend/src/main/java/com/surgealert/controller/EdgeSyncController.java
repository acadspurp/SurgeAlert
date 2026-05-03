package com.surgealert.controller;

import com.surgealert.dto.AlertTemplateDTO;
import com.surgealert.entity.AlertTemplate;
import com.surgealert.repository.AlertTemplateRepository;
import com.surgealert.service.ResidentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Special controller for the Edge System (Raspberry Pi) to sync data.
 * This allows the Pi to function even when the internet is unstable.
 */
@RestController
@RequestMapping("/api/edge/sync")
@CrossOrigin(origins = "*")
public class EdgeSyncController {

    private final ResidentService residentService;
    private final AlertTemplateRepository templateRepository;

    public EdgeSyncController(ResidentService residentService, AlertTemplateRepository templateRepository) {
        this.residentService = residentService;
        this.templateRepository = templateRepository;
    }

    /**
     * Returns everything the Pi needs to know to send SMS alerts offline.
     */
    @GetMapping("/all")
    public ResponseEntity<Map<String, Object>> syncAll(@RequestHeader(value = "X-Edge-Key", required = false) String edgeKey) {
        // In a real production system, we'd validate the edgeKey here.
        
        Map<String, Object> data = new HashMap<>();
        
        // 1. All Active Resident Phone Numbers
        data.put("residents", residentService.getAllActivePhoneNumbers());
        
        // 2. All SMS Templates
        List<AlertTemplateDTO> templates = templateRepository.findAll().stream()
                .map(t -> new AlertTemplateDTO(t.getId(), t.getAlertType(), t.getTemplate()))
                .collect(Collectors.toList());
        data.put("templates", templates);
        
        // 3. Current Active OTPs (Using reflection to access the private map if needed, 
        // or just providing a snapshot of what's in memory)
        data.put("otps", getActiveOtps());
        
        return ResponseEntity.ok(data);
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> getActiveOtps() {
        try {
            Field field = ResidentService.class.getDeclaredField("otpStorage");
            field.setAccessible(true);
            return (Map<String, String>) field.get(residentService);
        } catch (Exception e) {
            return new HashMap<>();
        }
    }
}
