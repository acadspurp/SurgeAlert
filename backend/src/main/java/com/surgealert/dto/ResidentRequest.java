package com.surgealert.dto;

public class ResidentRequest {
    private String phoneNumber;
    private String email;
    // --- ADDED FIELDS ---
    private String fullName;

    public ResidentRequest() {}

    public ResidentRequest(String phoneNumber, String email, String fullName) {
        this.phoneNumber = phoneNumber;
        this.email = email;
        this.fullName = fullName;
    }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    // --- ADDED GETTERS AND SETTERS ---
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
}