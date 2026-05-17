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
        // Avoid printing OTP/phone values in logs.
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
        resident.setIsPriority(request.getIsPriority() != null ? request.getIsPriority() : false);
        
        // REDACT NAME BEFORE SAVING
        String rawName = request.getFullName();
        if (rawName != null && !rawName.trim().isEmpty()) {
            String[] parts = rawName.trim().split("\\s+");
            if (parts.length > 1) {
                // "Juan Dela Cruz" -> "J. Cruz"
                resident.setFullName(parts[0].charAt(0) + ". " + parts[parts.length - 1]);
            } else {
                resident.setFullName(rawName.trim());
            }
        } else {
            resident.setFullName("Anonymous");
        }

        return residentRepository.save(resident);
    }

    @Transactional
    public void togglePriority(Long id) {
        Resident resident = residentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Resident not found"));
        resident.setIsPriority(!resident.getIsPriority());
        residentRepository.save(resident);
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
    // PRIORITIZED: Returns numbers sorted by isPriority DESC
    public List<String> getAllActivePhoneNumbers() {
        return residentRepository.findByIsActiveTrue().stream()
                .sorted((a, b) -> Boolean.compare(b.getIsPriority(), a.getIsPriority()))
                .map(Resident::getPhoneNumber)
                .collect(Collectors.toList());
    }

    /** Edge Pi offline SMS: phone + priority flag. */
    public List<Map<String, Object>> getActiveResidentsForEdgeSync() {
        return residentRepository.findByIsActiveTrue().stream()
                .sorted((a, b) -> Boolean.compare(
                        Boolean.TRUE.equals(b.getIsPriority()),
                        Boolean.TRUE.equals(a.getIsPriority())))
                .map(r -> {
                    Map<String, Object> entry = new java.util.LinkedHashMap<>();
                    entry.put("phoneNumber", r.getPhoneNumber());
                    entry.put("isPriority", Boolean.TRUE.equals(r.getIsPriority()));
                    return entry;
                })
                .collect(Collectors.toList());
    }

    // --- USED FOR ADMIN DASHBOARD (EXTERNAL USE - RETURNS MASKED DATA) ---
    public List<ResidentAdminDTO> getAllActiveResidentsForAdmin() {
        return residentRepository.findByIsActiveTrue().stream()
                .map(this::maskResidentData)
                .collect(Collectors.toList());
    }

    // MASKING HELPER
    private ResidentAdminDTO maskResidentData(Resident resident) {
        String rawPhone = resident.getPhoneNumber() != null ? resident.getPhoneNumber() : "";
        
        // Mask Phone: Keep only last 4 digits
        String maskedPhone = "******" + (rawPhone.length() > 4 ? rawPhone.substring(rawPhone.length() - 4) : rawPhone);

        // Note: Name is already redacted in DB at registration time
        return new ResidentAdminDTO(
                resident.getId(),
                resident.getFullName(),
                maskedPhone,
                resident.getIsPriority(),
                resident.getRegistrationDate()
        );
    }

    public Map<String, String> getActiveOtps() {
        return new java.util.HashMap<>(otpStorage);
    }
}