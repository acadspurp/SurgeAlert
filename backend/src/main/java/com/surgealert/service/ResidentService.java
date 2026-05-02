package com.surgealert.service;

import com.surgealert.dto.ResidentRequest;
import com.surgealert.entity.Resident;
import com.surgealert.repository.ResidentRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ResidentService {
    private final ResidentRepository residentRepository;
    
    // In-memory storage for OTPs (Key: PhoneNumber, Value: OTP)
    private final Map<String, String> otpStorage = new ConcurrentHashMap<>();

    public ResidentService(ResidentRepository residentRepository) {
        this.residentRepository = residentRepository;
    }

    // --- OTP LOGIC ---
    public String generateOtp(String phoneNumber) {
        // Generate random 6-digit code
        String otp = String.format("%06d", new Random().nextInt(999999));
        otpStorage.put(phoneNumber, otp);
        
        // Log to console (Simulating SMS sending)
        System.out.println(">>> GENERATED OTP for " + phoneNumber + ": " + otp);
        return otp;
    }

    public boolean verifyOtp(String phoneNumber, String code) {
        String validCode = otpStorage.get(phoneNumber);
        if (validCode != null && validCode.equals(code)) {
            otpStorage.remove(phoneNumber); // One-time use
            return true;
        }
        return false;
    }

    // --- REGISTRATION LOGIC ---
    public Resident registerResident(ResidentRequest request) {
        if (residentRepository.existsByPhoneNumber(request.getPhoneNumber())) {
            throw new RuntimeException("Phone number already registered");
        }

        Resident resident = new Resident();
        resident.setPhoneNumber(request.getPhoneNumber());
        resident.setEmail(request.getEmail());
        resident.setFullName(request.getFullName());
        resident.setAddress(request.getAddress());
        
        return residentRepository.save(resident);
    }

    public void unregisterResident(String phoneNumber) {
        Resident resident = residentRepository.findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new RuntimeException("Phone number not found"));
        resident.setIsActive(false);
        residentRepository.save(resident);
    }

    public List<String> getAllActivePhoneNumbers() {
        return residentRepository.findByIsActiveTrue().stream()
                .map(Resident::getPhoneNumber)
                .collect(Collectors.toList());
    }

    public List<String> getAllActiveEmails() {
        return residentRepository.findByIsActiveTrue().stream()
                .map(Resident::getEmail)
                .filter(email -> email != null && !email.isEmpty())
                .collect(Collectors.toList());
    }
}