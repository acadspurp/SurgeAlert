package com.surgealert.service;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Shared side-effects after a sensor reading is persisted (email + optional SMS command for HTTP ingest).
 */
@Service
public class AlertDispatchService {

    private final NotificationService notificationService;
    private final ResidentService residentService;
    private final EmailService emailService;

    public AlertDispatchService(
            NotificationService notificationService,
            ResidentService residentService,
            EmailService emailService) {
        this.notificationService = notificationService;
        this.residentService = residentService;
        this.emailService = emailService;
    }

    /**
     * @param httpResponsePayload when non-null, SMS command fields are written for the edge HTTP client
     */
    public void handleAfterSave(SensorData savedData, SensorDataDTO dto, Map<String, Object> httpResponsePayload) {
        String level = savedData.getCurrentAlertLevel();
        String messageToSend = notificationService.getAlertMessage(level);

        boolean isCritical = level != null && messageToSend != null && (
                level.equalsIgnoreCase("YELLOW")
                        || level.equalsIgnoreCase("ORANGE")
                        || level.equalsIgnoreCase("RED"));

        if (isCritical) {
            List<String> emails = residentService.getAllActiveEmails();
            if (!emails.isEmpty()) {
                String subject = "SurgeAlert: " + level + " LEVEL WARNING";
                for (String email : emails) {
                    emailService.sendAlertEmail(email, subject, messageToSend, dto.getSnapshotBase64());
                }
            }
        }

        if (httpResponsePayload == null) {
            return;
        }

        if (isCritical) {
            List<String> phoneNumbers = residentService.getAllActivePhoneNumbers();
            if (!phoneNumbers.isEmpty()) {
                httpResponsePayload.put("command", "SEND_SMS");
                httpResponsePayload.put("message", messageToSend);
                httpResponsePayload.put("recipients", phoneNumbers);
            } else {
                httpResponsePayload.put("command", "NO_RECIPIENTS");
            }
        } else {
            httpResponsePayload.put("command", "NO_ACTION");
        }
    }
}
