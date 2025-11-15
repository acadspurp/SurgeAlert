package com.surgealert.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "action_plans")
public class ActionPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String alertLevel; // GREEN, YELLOW, ORANGE, RED

    @Column(nullable = false)
    private String titleEn;

    @Column(nullable = false)
    private String titleTl;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String shortDescriptionEn;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String shortDescriptionTl;

    @ElementCollection
    @CollectionTable(name = "action_plan_actions", joinColumns = @JoinColumn(name = "action_plan_id"))
    @Column(name = "action", columnDefinition = "TEXT")
    private List<String> actionsEn;

    @ElementCollection
    @CollectionTable(name = "action_plan_actions_tl", joinColumns = @JoinColumn(name = "action_plan_id"))
    @Column(name = "action", columnDefinition = "TEXT")
    private List<String> actionsTl;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

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

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}