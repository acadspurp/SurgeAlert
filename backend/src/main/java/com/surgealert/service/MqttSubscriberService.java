package com.surgealert.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.surgealert.controller.SensorDataController;
import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.List;

@Service
public class MqttSubscriberService {

    private final MqttClient mqttClient;
    private final MqttConnectOptions mqttConnectOptions;
    private final SensorDataService sensorDataService;
    private final NotificationService notificationService;
    private final ResidentService residentService;
    private final EmailService emailService;
    private final CriticalAlertApprovalService criticalAlertApprovalService;
    private final AlertConfidenceService alertConfidenceService;
    private final OtpDeliveryService otpDeliveryService;
    private final ObjectMapper objectMapper;

    @Value("${mqtt.topic.sensor}")
    private String sensorTopic;

    public MqttSubscriberService(MqttClient mqttClient, MqttConnectOptions mqttConnectOptions,
                                 SensorDataService sensorDataService, NotificationService notificationService,
                                 ResidentService residentService, EmailService emailService,
                                 CriticalAlertApprovalService criticalAlertApprovalService,
                                 AlertConfidenceService alertConfidenceService,
                                 OtpDeliveryService otpDeliveryService) {
        this.mqttClient = mqttClient;
        this.mqttConnectOptions = mqttConnectOptions;
        this.sensorDataService = sensorDataService;
        this.notificationService = notificationService;
        this.residentService = residentService;
        this.emailService = emailService;
        this.criticalAlertApprovalService = criticalAlertApprovalService;
        this.alertConfidenceService = alertConfidenceService;
        this.otpDeliveryService = otpDeliveryService;
        this.objectMapper = new ObjectMapper();
    }

    @PostConstruct
    public void init() {
        try {
            mqttClient.connect(mqttConnectOptions);
            System.out.println(" [MQTT] Connected to Secure Broker at " + mqttClient.getServerURI());
            
            mqttClient.subscribe(sensorTopic, (topic, message) -> {
                try {
                    String payload = new String(message.getPayload());
                    
                    // 1. Parse JSON payload
                    SensorDataDTO dto = objectMapper.readValue(payload, SensorDataDTO.class);

                    // 2. Save Image Base64 (Using direct static variable as originally done)
                    if (dto.getSnapshotBase64() != null && !dto.getSnapshotBase64().isEmpty()) {
                        SensorDataController.currentImageBase64 = dto.getSnapshotBase64();
                    }

                    // 3. Save Data to Database
                    SensorData savedData = sensorDataService.saveSensorData(dto);

                    // 4. Alert & Email Logic
                    String level = savedData.getCurrentAlertLevel();
                    String messageToSend = notificationService.getAlertMessage(level, savedData.getWaterLevelM());

                    boolean isCritical = level.equalsIgnoreCase("YELLOW") ||
                                         level.equalsIgnoreCase("ORANGE") ||
                                         level.equalsIgnoreCase("RED");

                    if (isCritical && messageToSend != null) {
                        AlertConfidenceService.ConfidenceResult confidence = alertConfidenceService.evaluate(
                                "mqtt-ingest",
                                dto,
                                level,
                                savedData.getPredictedAlertLevel()
                        );
                        if (criticalAlertApprovalService.requiresApproval(level) && !confidence.highConfidence()) {
                            criticalAlertApprovalService.createPendingAlert("mqtt-ingest", messageToSend, savedData.getWaterLevelM());
                            return;
                        }
                        List<String> emails = residentService.getAllActiveEmails();
                        if (!emails.isEmpty()) {
                            String subject = "SurgeAlert: " + level + " LEVEL WARNING";
                            for (String email : emails) {
                                emailService.sendAlertEmail(email, subject, messageToSend, dto.getSnapshotBase64());
                            }
                        }

                        // Broadcast SMS to all residents via Hybrid system
                        List<String> allPhoneNumbers = residentService.getAllActivePhoneNumbers();
                        for (String phone : allPhoneNumbers) {
                            if (phone != null && !phone.isBlank()) {
                                OtpDeliveryService.DeliveryResult res = otpDeliveryService.deliverOtp(phone, messageToSend);
                                if ("GSM_FALLBACK".equals(res.channel())) {
                                    publishSmsToGsm(phone, messageToSend);
                                }
                            }
                        }
                    }
                    System.out.println(" [MQTT] Successfully processed sensor payload block - Alert Level: " + level);
                } catch (Exception e) {
                    System.err.println(" [MQTT] Error processing MQTT message: " + e.getMessage());
                }
            });
            System.out.println(" [MQTT] Subscribed to Topic: " + sensorTopic);
        } catch (MqttException e) {
            System.err.println(" [MQTT] FATAL: Could not connect to Broker! " + e.getMessage());
        }
    }

    public void publishSmsToGsm(String phoneNumber, String textMessage) {
        try {
            if (mqttClient.isConnected()) {
                // Ensure text is properly escaped for JSON
                String safeText = textMessage != null ? textMessage.replace("\"", "\\\"").replace("\n", "\\n") : "";
                String payload = String.format("{\"number\":\"%s\", \"message\":\"%s\"}", phoneNumber, safeText);
                org.eclipse.paho.client.mqttv3.MqttMessage message = new org.eclipse.paho.client.mqttv3.MqttMessage(payload.getBytes());
                message.setQos(1);
                mqttClient.publish("surgealert/outbound/sms", message);
                System.out.println(" [MQTT] Published SMS to GSM module for: " + phoneNumber);
            } else {
                System.err.println(" [MQTT] Cannot publish SMS; client disconnected.");
            }
        } catch (MqttException e) {
            System.err.println(" [MQTT] Failed to publish SMS to GSM module: " + e.getMessage());
        }
    }

    @PreDestroy
    public void cleanup() {
        try {
            if (mqttClient.isConnected()) {
                mqttClient.disconnect();
            }
        } catch (MqttException e) {
            e.printStackTrace();
        }
    }
}
