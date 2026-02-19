package com.surgealert.dto;

public class ResidentAdminDTO {
    private String fullName;
    private String phoneNumber; // This will be masked (e.g. ******1234)
    private String address;     // This will be masked (e.g. Marulas, ***)
    private String email;

    public ResidentAdminDTO(String fullName, String phoneNumber, String address, String email) {
        this.fullName = fullName;
        this.phoneNumber = phoneNumber;
        this.address = address;
        this.email = email;
    }

    // Getters and Setters
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}