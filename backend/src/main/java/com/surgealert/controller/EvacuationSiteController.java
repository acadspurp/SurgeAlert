package com.surgealert.controller;

import com.surgealert.dto.EvacuationSiteDTO;
import com.surgealert.service.EvacuationSiteService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public/evacuation-sites")
@CrossOrigin(origins = "*")
public class EvacuationSiteController {
    private final EvacuationSiteService evacuationSiteService;

    public EvacuationSiteController(EvacuationSiteService evacuationSiteService) {
        this.evacuationSiteService = evacuationSiteService;
    }

    @GetMapping
    public ResponseEntity<List<EvacuationSiteDTO>> getAllActiveSites() {
        return ResponseEntity.ok(evacuationSiteService.getAllActiveSites());
    }
}