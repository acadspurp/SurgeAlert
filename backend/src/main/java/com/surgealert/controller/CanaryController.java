package com.surgealert.controller;

import com.surgealert.service.CanaryRolloutService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/canary")
@CrossOrigin(origins = "*")
public class CanaryController {
    private final CanaryRolloutService canaryRolloutService;

    public CanaryController(CanaryRolloutService canaryRolloutService) {
        this.canaryRolloutService = canaryRolloutService;
    }

    @GetMapping("/health")
    public ResponseEntity<?> getCanaryHealth() {
        return ResponseEntity.ok(canaryRolloutService.getState());
    }

    @PostMapping("/phase/advance")
    public ResponseEntity<?> advance(Authentication authentication) {
        if (!isHeadAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Only HEAD_ADMIN can advance canary phase."));
        }
        return ResponseEntity.ok(canaryRolloutService.advancePhase());
    }

    @PostMapping("/phase/rollback")
    public ResponseEntity<?> rollback(Authentication authentication) {
        if (!isHeadAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Only HEAD_ADMIN can rollback canary phase."));
        }
        return ResponseEntity.ok(canaryRolloutService.rollbackPhase());
    }

    public static class ConfigRequest {
        public boolean enabled;
        public int percentage;
        public String allowlist;
    }

    @PostMapping("/config")
    public ResponseEntity<?> updateConfig(@RequestBody ConfigRequest request, Authentication authentication) {
        if (!isHeadAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Only HEAD_ADMIN can modify canary configuration."));
        }
        return ResponseEntity.ok(canaryRolloutService.updateConfig(request.enabled, request.percentage, request.allowlist));
    }

    private static boolean isHeadAdmin(Authentication authentication) {
        if (authentication == null) return false;
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if ("ROLE_HEAD_ADMIN".equalsIgnoreCase(authority.getAuthority())) return true;
        }
        return false;
    }
}
