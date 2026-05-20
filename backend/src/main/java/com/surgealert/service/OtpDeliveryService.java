package com.surgealert.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.surgealert.util.PhilippinePhoneUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class OtpDeliveryService {
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${surgealert.otp.online-preferred:true}")
    private boolean onlinePreferred;

    @Value("${surgealert.semaphore.enabled:false}")
    private boolean semaphoreEnabled;

    @Value("${surgealert.semaphore.api-url:https://api.semaphore.co/api/v4/messages}")
    private String semaphoreApiUrl;

    @Value("${surgealert.semaphore.api-key:}")
    private String semaphoreApiKey;

    @Value("${surgealert.semaphore.sender-name:SurgeAlert}")
    private String semaphoreSenderName;

    public OtpDeliveryService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public DeliveryResult deliverOtp(String phoneNumber, String otpMessage) {
        String tenDigit = PhilippinePhoneUtil.normalizeToTenDigit(phoneNumber);
        if (tenDigit == null) {
            return new DeliveryResult("GSM_FALLBACK", "INVALID_PHONE", "Invalid Philippine mobile number.");
        }
        if (onlinePreferred && semaphoreEnabled && sendViaSemaphore(tenDigit, otpMessage)) {
            return new DeliveryResult("SEMAPHORE", "SENT", "OTP sent via online SMS provider.");
        }
        return new DeliveryResult("GSM_FALLBACK", "PENDING_GSM", "Online provider unavailable; use GSM module fallback.");
    }

    private boolean sendViaSemaphore(String tenDigit, String message) {
        if (semaphoreApiKey == null || semaphoreApiKey.isBlank()) {
            return false;
        }
        try {
            String formattedNumber = PhilippinePhoneUtil.toSemaphoreDial(tenDigit);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            String body = String.format(
                    "apikey=%s&number=%s&message=%s&sendername=%s",
                    semaphoreApiKey,
                    formattedNumber,
                    java.net.URLEncoder.encode(message, "UTF-8"),
                    semaphoreSenderName
            );

            HttpEntity<String> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(semaphoreApiUrl, request, String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                return false;
            }
            return parseSemaphoreAccepted(response.getBody());
        } catch (Exception e) {
            System.err.println("Semaphore Delivery Error: " + e.getMessage());
            return false;
        }
    }

    private boolean parseSemaphoreAccepted(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return false;
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            if (!root.isArray() || root.isEmpty()) {
                return false;
            }
            boolean anyAccepted = false;
            for (JsonNode msg : root) {
                String status = msg.path("status").asText("").trim().toLowerCase();
                if (status.contains("failed") || status.contains("refunded")) {
                    return false;
                }
                if (!status.isEmpty()) {
                    anyAccepted = true;
                }
            }
            return anyAccepted;
        } catch (Exception e) {
            System.err.println("Semaphore response parse error: " + e.getMessage());
            return false;
        }
    }

    public record DeliveryResult(String channel, String status, String detail) {}
}
