package com.surgealert.dto;

public class ResidentRequest {
    private String phoneNumber;
    private String fullName;
    private Boolean isPriority = false;

    public ResidentRequest() {}

    public ResidentRequest(String phoneNumber, String fullName, Boolean isPriority) {
        this.phoneNumber = phoneNumber;
        this.fullName = fullName;
        this.isPriority = isPriority;
    }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public Boolean getIsPriority() { return isPriority; }
    public void setIsPriority(Boolean isPriority) { this.isPriority = isPriority; }
}