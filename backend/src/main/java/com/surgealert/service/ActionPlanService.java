package com.surgealert.service;

import com.surgealert.dto.ActionPlanDTO;
import com.surgealert.entity.ActionPlan;
import com.surgealert.repository.ActionPlanRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ActionPlanService {
    private final ActionPlanRepository actionPlanRepository;

    public ActionPlanService(ActionPlanRepository actionPlanRepository) {
        this.actionPlanRepository = actionPlanRepository;
    }

    public ActionPlanDTO getActionPlanByAlertLevel(String alertLevel) {
        return actionPlanRepository.findByAlertLevel(alertLevel)
                .map(this::convertToDTO)
                .orElse(null);
    }

    public List<ActionPlanDTO> getAllActionPlans() {
        return actionPlanRepository.findAll().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public ActionPlan createOrUpdateActionPlan(ActionPlan actionPlan) {
        return actionPlanRepository.save(actionPlan);
    }

    private ActionPlanDTO convertToDTO(ActionPlan actionPlan) {
        ActionPlanDTO dto = new ActionPlanDTO();
        dto.setAlertLevel(actionPlan.getAlertLevel());
        dto.setTitleEn(actionPlan.getTitleEn());
        dto.setTitleTl(actionPlan.getTitleTl());
        dto.setShortDescriptionEn(actionPlan.getShortDescriptionEn());
        dto.setShortDescriptionTl(actionPlan.getShortDescriptionTl());
        dto.setActionsEn(actionPlan.getActionsEn());
        dto.setActionsTl(actionPlan.getActionsTl());
        return dto;
    }
}