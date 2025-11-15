package com.surgealert.dto;

public class ResidentRequest {
    private String phoneNumber;

    public ResidentRequest() {}

    public ResidentRequest(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
}