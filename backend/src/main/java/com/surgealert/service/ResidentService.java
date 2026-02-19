package com.surgealert.service;

import com.surgealert.dto.ResidentAdminDTO;
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
        // Note: Because we use the AttributeEncryptor, findByPhoneNumber automatically encrypts the input
        // to search the DB, finds the row, and decrypts it back to the object.
        Resident resident = residentRepository.findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new RuntimeException("Phone number not found"));

        resident.setIsActive(false);
        residentRepository.save(resident);
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
        String rawPhone = resident.getPhoneNumber();
        String rawAddress = resident.getAddress();
        String rawName = resident.getFullName();

        // 1. Mask Phone: Keep only last 4 digits (e.g. ******6789)
        String maskedPhone = "******" + (rawPhone.length() > 4 ? rawPhone.substring(rawPhone.length() - 4) : rawPhone);

        // 2. Mask Address: Show only Barangay/City (Assumes format: "Street, Barangay, City")
        // Logic: Removes everything before the first comma. If no comma, shows text as is.
        String maskedAddress = rawAddress;
        if (rawAddress.contains(",")) {
            maskedAddress = rawAddress.substring(rawAddress.indexOf(",") + 1).trim();
        }

        // 3. Abbreviate Name: "Juan Dela Cruz" -> "J. Cruz"
        String abbreviatedName = rawName;
        String[] parts = rawName.trim().split("\\s+");
        if (parts.length > 1) {
            // First Initial + . + Last Word
            abbreviatedName = parts[0].charAt(0) + ". " + parts[parts.length - 1];
        }

        return new ResidentAdminDTO(
                abbreviatedName,
                maskedPhone,
                maskedAddress,
                resident.getEmail()
        );
    }
}