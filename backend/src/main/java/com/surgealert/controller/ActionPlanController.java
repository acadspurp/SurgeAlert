package com.surgealert.controller;

import com.surgealert.dto.ActionPlanDTO;
import com.surgealert.service.ActionPlanService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public/action-plans")
@CrossOrigin(origins = "*")
public class ActionPlanController {
    private final ActionPlanService actionPlanService;

    public ActionPlanController(ActionPlanService actionPlanService) {
        this.actionPlanService = actionPlanService;
    }

    @GetMapping("/{alertLevel}")
    public ResponseEntity<ActionPlanDTO> getActionPlanByAlertLevel(@PathVariable String alertLevel) {
        ActionPlanDTO plan = actionPlanService.getActionPlanByAlertLevel(alertLevel.toUpperCase());
        if (plan == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(plan);
    }

    @GetMapping
    public ResponseEntity<List<ActionPlanDTO>> getAllActionPlans() {
        return ResponseEntity.ok(actionPlanService.getAllActionPlans());
    }
}