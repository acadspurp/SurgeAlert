package com.surgealert.service;

import com.surgealert.dto.ResidentAdminDTO;
import com.surgealert.dto.ResidentRequest;
import com.surgealert.entity.Resident;
import com.surgealert.repository.ResidentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ResidentService {

    private final ResidentRepository residentRepository;

    @Value("${surgealert.otp.ttl-minutes:10}")
    private int otpTtlMinutes;

    // Active OTP codes (phone -> entry)
    private final Map<String, OtpEntry> otpStorage = new ConcurrentHashMap<>();
    // Phones that passed verify-otp and may register while strict mode is on
    private final Map<String, Instant> verifiedForRegistration = new ConcurrentHashMap<>();

    public ResidentService(ResidentRepository residentRepository) {
        this.residentRepository = residentRepository;
    }

    public int getOtpTtlMinutes() {
        return otpTtlMinutes;
    }

    // --- OTP LOGIC ---
    public String generateOtp(String phoneNumber) {
        purgeExpired();
        String otp = String.format("%06d", new Random().nextInt(999999));
        Instant expiresAt = Instant.now().plusSeconds(otpTtlMinutes * 60L);
        otpStorage.put(phoneNumber, new OtpEntry(otp, expiresAt));
        return otp;
    }

    /** @param markForRegistration when true (subscribe verify), allows /register while strict mode is on */
    public boolean verifyOtp(String phoneNumber, String code, boolean markForRegistration) {
        purgeExpired();
        OtpEntry entry = otpStorage.get(phoneNumber);
        if (entry == null || entry.isExpired()) {
            if (entry != null) {
                otpStorage.remove(phoneNumber);
            }
            return false;
        }
        if (!entry.code.equals(code)) {
            return false;
        }
        otpStorage.remove(phoneNumber);
        if (markForRegistration) {
            verifiedForRegistration.put(phoneNumber, Instant.now().plusSeconds(otpTtlMinutes * 60L));
        }
        return true;
    }

    public boolean isVerifiedForRegistration(String phoneNumber) {
        purgeExpired();
        Instant until = verifiedForRegistration.get(phoneNumber);
        if (until == null) {
            return false;
        }
        if (Instant.now().isAfter(until)) {
            verifiedForRegistration.remove(phoneNumber);
            return false;
        }
        return true;
    }

    public void consumeRegistrationVerification(String phoneNumber) {
        verifiedForRegistration.remove(phoneNumber);
    }

    // --- REGISTRATION LOGIC ---
    public Resident registerResident(ResidentRequest request) {
        if (residentRepository.existsByPhoneNumber(request.getPhoneNumber())) {
            throw new RuntimeException("Phone number already registered");
        }

        Resident resident = new Resident();
        resident.setPhoneNumber(request.getPhoneNumber());
        resident.setIsPriority(request.getIsPriority() != null ? request.getIsPriority() : false);

        String rawName = request.getFullName();
        if (rawName != null && !rawName.trim().isEmpty()) {
            String[] parts = rawName.trim().split("\\s+");
            if (parts.length > 1) {
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

    public List<String> getAllActivePhoneNumbers() {
        return residentRepository.findByIsActiveTrue().stream()
                .sorted((a, b) -> Boolean.compare(
                        Boolean.TRUE.equals(b.getIsPriority()),
                        Boolean.TRUE.equals(a.getIsPriority())))
                .map(Resident::getPhoneNumber)
                .collect(Collectors.toList());
    }

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

    public List<ResidentAdminDTO> getAllActiveResidentsForAdmin() {
        return residentRepository.findByIsActiveTrue().stream()
                .map(this::maskResidentData)
                .collect(Collectors.toList());
    }

    private ResidentAdminDTO maskResidentData(Resident resident) {
        String rawPhone = resident.getPhoneNumber() != null ? resident.getPhoneNumber() : "";
        String maskedPhone = "******" + (rawPhone.length() > 4 ? rawPhone.substring(rawPhone.length() - 4) : rawPhone);
        return new ResidentAdminDTO(
                resident.getId(),
                resident.getFullName(),
                maskedPhone,
                resident.getIsPriority(),
                resident.getRegistrationDate()
        );
    }

    /** Non-expired OTPs only — edge Pi offline cache. */
    public Map<String, String> getActiveOtps() {
        purgeExpired();
        Map<String, String> active = new HashMap<>();
        otpStorage.forEach((phone, entry) -> {
            if (!entry.isExpired()) {
                active.put(phone, entry.code);
            }
        });
        return active;
    }

    private void purgeExpired() {
        Instant now = Instant.now();
        otpStorage.entrySet().removeIf(e -> e.getValue().isExpired());
        verifiedForRegistration.entrySet().removeIf(e -> now.isAfter(e.getValue()));
    }
}
