package com.surgealert.service;

import com.surgealert.dto.ResidentAdminDTO;
import com.surgealert.dto.ResidentRequest;
import com.surgealert.entity.Resident;
import com.surgealert.repository.ResidentRepository;
import com.surgealert.util.PhoneNormalizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ResidentService {

    private static final int OTP_EXPIRY_SECONDS = 600;
    private static final int MAX_OTP_SENDS_PER_WINDOW = 5;
    private static final long OTP_SEND_WINDOW_MS = 15 * 60_000L;
    private static final int MAX_OTP_VERIFY_ATTEMPTS = 8;

    private final ResidentRepository residentRepository;
    private final PhoneSearchHashService phoneSearchHashService;
    private final ResidentProofService residentProofService;

    private final SecureRandom secureRandom = new SecureRandom();

    private final Map<String, OtpHolder> otpStorage = new ConcurrentHashMap<>();
    private final Map<String, Deque<Long>> otpSendHistory = new ConcurrentHashMap<>();

    @Value("${surgealert.otp.expose-in-response:false}")
    private boolean exposeOtpInResponse;

    public ResidentService(
            ResidentRepository residentRepository,
            PhoneSearchHashService phoneSearchHashService,
            ResidentProofService residentProofService) {
        this.residentRepository = residentRepository;
        this.phoneSearchHashService = phoneSearchHashService;
        this.residentProofService = residentProofService;
    }

    public Map<String, Object> generateOtp(String rawPhone) {
        String normalized = PhoneNormalizer.normalize(rawPhone);
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Phone number is required");
        }
        enforceOtpSendRate(normalized);

        byte[] buf = new byte[4];
        secureRandom.nextBytes(buf);
        int n = Math.abs(java.nio.ByteBuffer.wrap(buf).getInt()) % 1_000_000;
        String otp = String.format("%06d", n);

        otpStorage.put(normalized, new OtpHolder(otp, Instant.now().plusSeconds(OTP_EXPIRY_SECONDS), 0));

        java.util.HashMap<String, Object> body = new java.util.HashMap<>();
        body.put("status", "sent");
        if (exposeOtpInResponse) {
            body.put("dev_otp", otp);
        }
        return body;
    }

    private void enforceOtpSendRate(String normalizedPhone) {
        long now = System.currentTimeMillis();
        Deque<Long> dq = otpSendHistory.computeIfAbsent(normalizedPhone, k -> new ArrayDeque<>());
        synchronized (dq) {
            while (!dq.isEmpty() && now - dq.peekFirst() > OTP_SEND_WINDOW_MS) {
                dq.pollFirst();
            }
            if (dq.size() >= MAX_OTP_SENDS_PER_WINDOW) {
                throw new IllegalStateException("Too many OTP requests. Try again later.");
            }
            dq.addLast(now);
        }
    }

    public Map<String, Object> verifyOtp(String rawPhone, String code, String purpose) {
        String normalized = PhoneNormalizer.normalize(rawPhone);
        if (normalized.isBlank() || code == null || code.isBlank()) {
            throw new IllegalArgumentException("Phone and code are required");
        }
        OtpHolder holder = otpStorage.get(normalized);
        if (holder == null || holder.expires.isBefore(Instant.now())) {
            otpStorage.remove(normalized);
            throw new IllegalArgumentException("Invalid or expired OTP");
        }
        if (holder.getFailedAttempts() >= MAX_OTP_VERIFY_ATTEMPTS) {
            otpStorage.remove(normalized);
            throw new IllegalStateException("Too many invalid attempts. Request a new OTP.");
        }
        if (!constantTimeEquals(holder.getCode(), code.trim())) {
            holder.incrementFailures();
            throw new IllegalArgumentException("Invalid OTP");
        }
        otpStorage.remove(normalized);

        ResidentProofService.Kind kind = "UNSUBSCRIBE".equalsIgnoreCase(purpose)
                ? ResidentProofService.Kind.UNSUBSCRIBE
                : ResidentProofService.Kind.REGISTER;
        String token = residentProofService.issue(normalized, kind);

        java.util.HashMap<String, Object> out = new java.util.HashMap<>();
        out.put("verified", true);
        if (kind == ResidentProofService.Kind.REGISTER) {
            out.put("registrationToken", token);
        } else {
            out.put("unsubscribeToken", token);
        }
        return out;
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        byte[] x = a.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] y = b.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if (x.length != y.length) {
            return false;
        }
        return MessageDigest.isEqual(x, y);
    }

    @Transactional
    public Resident registerResident(ResidentRequest request, String registrationToken) {
        residentProofService.verifyAndConsume(registrationToken, request.getPhoneNumber(), ResidentProofService.Kind.REGISTER);

        String normalized = PhoneNormalizer.normalize(request.getPhoneNumber());
        String hash = phoneSearchHashService.hashNormalized(normalized);
        if (residentRepository.existsByPhoneSearchHash(hash)) {
            throw new IllegalStateException("Phone number already registered");
        }

        Resident resident = new Resident();
        resident.setPhoneNumber(request.getPhoneNumber());
        resident.setPhoneSearchHash(hash);
        resident.setEmail(request.getEmail());
        resident.setFullName(request.getFullName());

        return residentRepository.save(resident);
    }

    @Transactional
    public void unregisterResident(String phoneNumber) {
        Resident resident = findByAnyPhone(phoneNumber)
                .orElseThrow(() -> new RuntimeException("Phone number not found"));
        residentRepository.deleteById(resident.getId());
    }

    @Transactional
    public boolean unregisterResidentByPhoneSilently(String phoneNumber) {
        return findByAnyPhone(phoneNumber)
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
                .map(Resident::getPhoneNumber)
                .collect(Collectors.toList());
    }

    public List<String> getAllActiveEmails() {
        return residentRepository.findByIsActiveTrue().stream()
                .map(Resident::getEmail)
                .filter(email -> email != null && !email.isEmpty())
                .collect(Collectors.toList());
    }

    public List<ResidentAdminDTO> getAllActiveResidentsForAdmin() {
        return residentRepository.findByIsActiveTrue().stream()
                .map(this::maskResidentData)
                .collect(Collectors.toList());
    }

    @Transactional
    public boolean completeUnsubscribeWithProof(String rawPhone, String unsubscribeToken) {
        residentProofService.verifyAndConsume(unsubscribeToken, rawPhone, ResidentProofService.Kind.UNSUBSCRIBE);
        return unregisterResidentByPhoneSilently(rawPhone);
    }

    private Optional<Resident> findByAnyPhone(String rawPhone) {
        String hash = phoneSearchHashService.hashRaw(rawPhone);
        return residentRepository.findByPhoneSearchHash(hash);
    }

    private ResidentAdminDTO maskResidentData(Resident resident) {
        String rawPhone = resident.getPhoneNumber() != null ? resident.getPhoneNumber() : "";
        String rawName = resident.getFullName() != null ? resident.getFullName() : "";

        String maskedPhone = "******" + (rawPhone.length() > 4 ? rawPhone.substring(rawPhone.length() - 4) : rawPhone);

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

    private static final class OtpHolder {
        private final String code;
        private final Instant expires;
        private int failedAttempts;

        private OtpHolder(String code, Instant expires, int failedAttempts) {
            this.code = code;
            this.expires = expires;
            this.failedAttempts = failedAttempts;
        }

        private String getCode() {
            return code;
        }

        private Instant getExpires() {
            return expires;
        }

        private int getFailedAttempts() {
            return failedAttempts;
        }

        private void incrementFailures() {
            this.failedAttempts++;
        }
    }

    /**
     * Backfills {@link Resident#phoneSearchHash} for rows created before hashing was added.
     */
    @Transactional
    public void backfillPhoneSearchHashes() {
        List<Resident> missing = residentRepository.findByPhoneSearchHashIsNull();
        for (Resident r : missing) {
            String phone = r.getPhoneNumber();
            if (phone == null || phone.isBlank()) {
                continue;
            }
            String hash = phoneSearchHashService.hashRaw(phone);
            r.setPhoneSearchHash(hash);
            residentRepository.save(r);
        }
    }
}
