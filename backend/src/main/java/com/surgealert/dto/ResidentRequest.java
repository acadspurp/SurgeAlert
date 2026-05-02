package com.surgealert.dto;

public class ResidentRequest {
    private String phoneNumber;
    private String email;
    // --- ADDED FIELDS ---
    private String fullName;
    private String address;

    public ResidentRequest() {}

    public ResidentRequest(String phoneNumber, String email, String fullName, String address) {
        this.phoneNumber = phoneNumber;
        this.email = email;
        this.fullName = fullName;
        this.address = address;
    }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    // --- ADDED GETTERS AND SETTERS ---
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
}