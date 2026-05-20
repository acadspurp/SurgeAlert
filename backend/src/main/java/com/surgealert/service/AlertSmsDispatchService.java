package com.surgealert.service;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.function.BiConsumer;

/**
 * Sends resident SMS only when alert level changes; uses predicted alert to gate false alarms.
 */
@Service
public class AlertSmsDispatchService {

    private final AlertNotificationStateService alertNotificationStateService;
    private final NotificationService notificationService;
    private final ResidentService residentService;
    private final CriticalAlertApprovalService criticalAlertApprovalService;
    private final AlertConfidenceService alertConfidenceService;
    private final OtpDeliveryService otpDeliveryService;

    public AlertSmsDispatchService(
            AlertNotificationStateService alertNotificationStateService,
            NotificationService notificationService,
            ResidentService residentService,
            CriticalAlertApprovalService criticalAlertApprovalService,
            AlertConfidenceService alertConfidenceService,
            OtpDeliveryService otpDeliveryService) {
        this.alertNotificationStateService = alertNotificationStateService;
        this.notificationService = notificationService;
        this.residentService = residentService;
        this.criticalAlertApprovalService = criticalAlertApprovalService;
        this.alertConfidenceService = alertConfidenceService;
        this.otpDeliveryService = otpDeliveryService;
    }

  /**
   * @param gsmPublisher callback (phone, message) when online delivery falls back to Pi GSM via MQTT
   */
    public boolean dispatchIfLevelChanged(
            String sensorId,
            SensorData savedData,
            SensorDataDTO dto,
            BiConsumer<String, String> gsmPublisher) {
        if (savedData == null) {
            return false;
        }
        String level = savedData.getCurrentAlertLevel();
        if (!alertNotificationStateService.shouldDispatchSms(level, savedData.getPredictedAlertLevel())) {
            return false;
        }
        final String levelToMark = level;

        String messageToSend = notificationService.getAlertMessage(level, savedData.getWaterLevelM());
        if (messageToSend == null) {
            if ("GREEN".equalsIgnoreCase(level)) {
                messageToSend = String.format(
                        Locale.ENGLISH,
                        "SurgeAlert: Alert level is now GREEN. Water level %.2fm.",
                        savedData.getWaterLevelM() != null ? savedData.getWaterLevelM() : 0.0);
            } else {
                return false;
            }
        }

        boolean isCritical = level.equalsIgnoreCase("YELLOW")
                || level.equalsIgnoreCase("ORANGE")
                || level.equalsIgnoreCase("RED");

        if (isCritical) {
            AlertConfidenceService.ConfidenceResult confidence = alertConfidenceService.evaluate(
                    sensorId == null ? "mqtt-ingest" : sensorId,
                    dto,
                    level,
                    savedData.getPredictedAlertLevel());
            if (criticalAlertApprovalService.requiresApproval(level) && !confidence.highConfidence()) {
                criticalAlertApprovalService.createPendingAlert(
                        sensorId == null ? "edge-unknown" : sensorId,
                        messageToSend,
                        savedData.getWaterLevelM());
                return false;
            }
        }

        List<String> phones = residentService.getAllActivePhoneNumbers();
        for (String phone : phones) {
            if (phone == null || phone.isBlank()) {
                continue;
            }
            OtpDeliveryService.DeliveryResult res = otpDeliveryService.deliverOtp(phone, messageToSend);
            if ("GSM_FALLBACK".equals(res.channel()) && gsmPublisher != null) {
                gsmPublisher.accept(phone, messageToSend);
            }
        }
        alertNotificationStateService.markDispatched(levelToMark);
        return true;
    }
}
