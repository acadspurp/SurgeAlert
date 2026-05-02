package com.surgealert.service;

import com.surgealert.entity.AlertTemplate;
import com.surgealert.repository.AlertTemplateRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class NotificationService {

    private final AlertTemplateRepository templateRepository;
    private final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM dd, hh:mm a");

    public NotificationService(AlertTemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    public String getAlertMessage(String level) {
        return templateRepository.findByAlertType(level.toUpperCase())
                .map(t -> {
                    String timestamp = LocalDateTime.now().format(formatter);
                    // Replaces [%s] in the database text with the actual timestamp
                    return String.format(t.getTemplate(), timestamp);
                })
                .orElse(null); // Return null if not found
    }

    public String getOtpMessage(String otpCode) {
        return templateRepository.findByAlertType("OTP")
                .map(t -> String.format(t.getTemplate(), otpCode))
                .orElse("Your OTP is: " + otpCode);
    }
    
    public String getManualMessage(String customMessage) {
        return templateRepository.findByAlertType("MANUAL")
                .map(t -> {
                    String timestamp = LocalDateTime.now().format(formatter);
                    // Replaces first %s with message, second %s with timestamp
                    return String.format(t.getTemplate(), customMessage, timestamp);
                })
                .orElse(customMessage);
    }
}