package com.surgealert.dto;

public class ResidentAdminDTO {
    private Long id;
    private String fullName;
    private String phoneNumber; // Masked for display
    private Boolean isPriority;
    private java.time.LocalDateTime registrationDate;

    public ResidentAdminDTO(Long id, String fullName, String phoneNumber, Boolean isPriority, java.time.LocalDateTime registrationDate) {
        this.id = id;
        this.fullName = fullName;
        this.phoneNumber = phoneNumber;
        this.isPriority = isPriority;
        this.registrationDate = registrationDate;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public Boolean getIsPriority() { return isPriority; }
    public void setIsPriority(Boolean isPriority) { this.isPriority = isPriority; }

    public java.time.LocalDateTime getRegistrationDate() { return registrationDate; }
    public void setRegistrationDate(java.time.LocalDateTime registrationDate) { this.registrationDate = registrationDate; }
}