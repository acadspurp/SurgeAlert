package com.surgealert.controller;

import com.surgealert.service.CriticalAlertApprovalService;
import com.surgealert.service.ManualOverrideService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;

/**
 * Head-admin alert controls (requires JWT on /api/admin/**, not the public API chain).
 */
@RestController
@RequestMapping("/api/admin/alerts")
@CrossOrigin(origins = "*")
public class AdminAlertController {

    private final ManualOverrideService manualOverrideService;
    private final CriticalAlertApprovalService criticalAlertApprovalService;

    public AdminAlertController(
            ManualOverrideService manualOverrideService,
            CriticalAlertApprovalService criticalAlertApprovalService) {
        this.manualOverrideService = manualOverrideService;
        this.criticalAlertApprovalService = criticalAlertApprovalService;
    }

    @PostMapping("/override")
    public ResponseEntity<Map<String, String>> setOverride(@RequestBody Map<String, String> body) {
        String level = body.get("level");
        if (level == null || level.trim().isEmpty() || level.equalsIgnoreCase("NORMAL")) {
            manualOverrideService.clearOverride();
            UserController.addLog("Admin cleared manual override. System returned to AUTO.");
        } else {
            String normalized = level.toUpperCase().trim();
            manualOverrideService.setOverrideLevel(normalized);
            UserController.addLog("Admin invoked manual override to " + normalized + ".");
        }
        return ResponseEntity.ok(Collections.singletonMap("status", "success"));
    }

    @PostMapping("/critical/pending/{id}/approve")
    public ResponseEntity<?> approveCritical(@PathVariable String id) {
        CriticalAlertApprovalService.PendingCriticalAlert pending = criticalAlertApprovalService.approve(id);
        if (pending == null) {
            return ResponseEntity.notFound().build();
        }
        UserController.addLog("Critical alert " + id + " approval set to " + pending.status() + ".");
        return ResponseEntity.ok(pending);
    }

    @PostMapping("/critical/pending/{id}/reject")
    public ResponseEntity<?> rejectCritical(@PathVariable String id) {
        CriticalAlertApprovalService.PendingCriticalAlert pending = criticalAlertApprovalService.reject(id);
        if (pending == null) {
            return ResponseEntity.notFound().build();
        }
        UserController.addLog("Critical alert " + id + " approval set to " + pending.status() + ".");
        return ResponseEntity.ok(pending);
    }
}
