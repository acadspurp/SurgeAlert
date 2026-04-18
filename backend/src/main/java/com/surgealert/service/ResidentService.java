package com.surgealert.service;

import com.surgealert.dto.ResidentAdminDTO;
import com.surgealert.dto.ResidentRequest;
import com.surgealert.entity.Resident;
import com.surgealert.repository.ResidentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

        return residentRepository.save(resident);
    }

    @Transactional
    public void unregisterResident(String phoneNumber) {
        Resident resident = residentRepository.findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new RuntimeException("Phone number not found"));
        residentRepository.deleteById(resident.getId());
    }

    @Transactional
    public boolean unregisterResidentByPhoneSilently(String phoneNumber) {
        return residentRepository.findByPhoneNumber(phoneNumber)
                .map(resident -> {
                    residentRepository.delete(resident);
                    return true;
                })
                .orElse(false);
    }

    @Transactional
    public void unregisterResidentById(Long id) {
        Resident resident = residentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Resident not found"));
        residentRepository.delete(resident);
    }

    // --- USED FOR SMS ALERTS (INTERNAL USE - RETURNS RAW DATA) ---
    // The system needs the REAL phone numbers to send alerts.
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

    // --- USED FOR ADMIN DASHBOARD (EXTERNAL USE - RETURNS MASKED DATA) ---
    // We strictly convert to DTO here to hide sensitive info
    public List<ResidentAdminDTO> getAllActiveResidentsForAdmin() {
        return residentRepository.findByIsActiveTrue().stream()
                .map(this::maskResidentData)
                .collect(Collectors.toList());
    }

    // MASKING HELPER
    private ResidentAdminDTO maskResidentData(Resident resident) {
        String rawPhone = resident.getPhoneNumber() != null ? resident.getPhoneNumber() : "";
        String rawName = resident.getFullName() != null ? resident.getFullName() : "";

        // 1. Mask Phone: Keep only last 4 digits (e.g. ******6789); full number is AES-encrypted in DB
        String maskedPhone = "******" + (rawPhone.length() > 4 ? rawPhone.substring(rawPhone.length() - 4) : rawPhone);

        // 2. Abbreviate Name: "Juan Dela Cruz" -> "J. Cruz"
        String abbreviatedName = rawName;
        String[] parts = rawName.trim().split("\\s+");
        if (parts.length > 1) {
            abbreviatedName = parts[0].charAt(0) + ". " + parts[parts.length - 1];
        }

        return new ResidentAdminDTO(
                resident.getId(),
                abbreviatedName,
                maskedPhone,
                resident.getEmail()
        );
    }
}