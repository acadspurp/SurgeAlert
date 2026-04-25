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
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, Object> body = Map.of(
                    "apikey", semaphoreApiKey,
                    "number", phoneNumber,
                    "message", message,
                    "sendername", semaphoreSenderName
            );
            restTemplate.postForEntity(semaphoreApiUrl, new HttpEntity<>(body, headers), String.class);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    public record DeliveryResult(String channel, String status, String detail) {}
}
