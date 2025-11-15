package com.surgealert.dto;

import java.util.List;

public class ActionPlanDTO {
    private String alertLevel;
    private String titleEn;
    private String titleTl;
    private String shortDescriptionEn;
    private String shortDescriptionTl;
    private List<String> actionsEn;
    private List<String> actionsTl;

    public ActionPlanDTO() {}

    // Getters and Setters
    public String getAlertLevel() { return alertLevel; }
    public void setAlertLevel(String alertLevel) { this.alertLevel = alertLevel; }

    public String getTitleEn() { return titleEn; }
    public void setTitleEn(String titleEn) { this.titleEn = titleEn; }

    public String getTitleTl() { return titleTl; }
    public void setTitleTl(String titleTl) { this.titleTl = titleTl; }

    public String getShortDescriptionEn() { return shortDescriptionEn; }
    public void setShortDescriptionEn(String shortDescriptionEn) { this.shortDescriptionEn = shortDescriptionEn; }

    public String getShortDescriptionTl() { return shortDescriptionTl; }
    public void setShortDescriptionTl(String shortDescriptionTl) { this.shortDescriptionTl = shortDescriptionTl; }

    public List<String> getActionsEn() { return actionsEn; }
    public void setActionsEn(List<String> actionsEn) { this.actionsEn = actionsEn; }

    public List<String> getActionsTl() { return actionsTl; }
    public void setActionsTl(List<String> actionsTl) { this.actionsTl = actionsTl; }
}