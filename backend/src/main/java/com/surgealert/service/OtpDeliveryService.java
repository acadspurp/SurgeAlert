package com.surgealert.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class OtpDeliveryService {
    private final RestTemplate restTemplate;

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
        if (onlinePreferred && sendViaSemaphore(phoneNumber, otpMessage)) {
            return new DeliveryResult("SEMAPHORE", "SENT", "OTP sent via online SMS provider.");
        }
        return new DeliveryResult("GSM_FALLBACK", "PENDING_GSM", "Online provider unavailable; use GSM module fallback.");
    }

    private boolean sendViaSemaphore(String phoneNumber, String message) {
        if (!semaphoreEnabled || semaphoreApiKey == null || semaphoreApiKey.isBlank()) {
            return false;
        }
        try {
            // Semaphore expects 09XXXXXXXXX format or 639XXXXXXXXX. 
            // We ensure it starts with 0 for reliability.
            String formattedNumber = phoneNumber.startsWith("0") ? phoneNumber : "0" + phoneNumber;

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
            restTemplate.postForEntity(semaphoreApiUrl, request, String.class);
            return true;
        } catch (Exception e) {
            System.err.println("Semaphore Delivery Error: " + e.getMessage());
            return false;
        }
    }

    public record DeliveryResult(String channel, String status, String detail) {}
}
