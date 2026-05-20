package com.surgealert.service;

import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final AlertSmsDispatchService alertSmsDispatchService;
    private final ObjectMapper objectMapper;

    @Value("${mqtt.topic.sensor}")
    private String sensorTopic;

    public MqttSubscriberService(MqttClient mqttClient, MqttConnectOptions mqttConnectOptions,
            SensorDataService sensorDataService,
            AlertSmsDispatchService alertSmsDispatchService) {
        this.mqttClient = mqttClient;
        this.mqttConnectOptions = mqttConnectOptions;
        this.sensorDataService = sensorDataService;
        this.alertSmsDispatchService = alertSmsDispatchService;
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

                    // 2. Save telemetry only (images via HTTPS /edge/sync/snapshot)
                    SensorData savedData = sensorDataService.saveSensorDataFromMqtt(dto);
                    if (savedData == null)
                        return; // Ignore erroneous reading

                    alertSmsDispatchService.dispatchIfLevelChanged(
                            "mqtt-ingest",
                            savedData,
                            dto,
                            this::publishSmsToGsm);
                    System.out.println(" [MQTT] Successfully processed sensor payload - Alert Level: "
                            + savedData.getCurrentAlertLevel());
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
                org.eclipse.paho.client.mqttv3.MqttMessage message = new org.eclipse.paho.client.mqttv3.MqttMessage(
                        payload.getBytes());
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
