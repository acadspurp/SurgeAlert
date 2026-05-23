package com.surgealert.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.util.PhilippinePhoneUtil;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class MqttSubscriberService {

    private final MqttClient mqttClient;
    private final MqttConnectOptions mqttConnectOptions;
    private final SensorDataService sensorDataService;
    private final AlertSmsDispatchService alertSmsDispatchService;
    private final ObjectMapper objectMapper;

    @Value("${mqtt.topic.sensor}")
    private String sensorTopic;

    private final AtomicBoolean mqttConnected = new AtomicBoolean(false);

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
            mqttConnected.set(true);
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
                            (phone, msg) -> publishSmsToGsm(phone, msg, "alert"));
                    System.out.println(" [MQTT] Successfully processed sensor payload - Alert Level: "
                            + savedData.getCurrentAlertLevel());
                } catch (Exception e) {
                    System.err.println(" [MQTT] Error processing MQTT message: " + e.getMessage());
                }
            });
            System.out.println(" [MQTT] Subscribed to Topic: " + sensorTopic);
        } catch (MqttException e) {
            mqttConnected.set(false);
            System.err.println(" [MQTT] FATAL: Could not connect to Broker! " + e.getMessage());
        }
    }

    public boolean isMqttConnected() {
        return mqttConnected.get() && mqttClient.isConnected();
    }

    public static final String SMS_OUTBOUND_TOPIC = "surgealert/outbound/sms";

    public boolean publishSmsToGsm(String phoneNumber, String textMessage) {
        return publishSmsToGsm(phoneNumber, textMessage, "otp");
    }

    public boolean publishSmsToGsm(String phoneNumber, String textMessage, String priority) {
        try {
            if (!mqttClient.isConnected()) {
                System.err.println(" [MQTT] Cannot publish SMS; client disconnected.");
                return false;
            }
            String tenDigit = PhilippinePhoneUtil.normalizeToTenDigit(phoneNumber);
            if (tenDigit == null) {
                System.err.println(" [MQTT] Cannot publish SMS; invalid phone: " + phoneNumber);
                return false;
            }
            String dial = PhilippinePhoneUtil.toGsmDial(tenDigit);
            String safeText = textMessage != null ? textMessage.replace("\"", "\\\"").replace("\n", "\\n") : "";
            String safePriority = "alert".equalsIgnoreCase(priority) ? "alert" : "otp";
            String payload = String.format(
                    "{\"number\":\"%s\",\"phoneNumber\":\"%s\",\"message\":\"%s\",\"priority\":\"%s\"}",
                    dial, tenDigit, safeText, safePriority);
            MqttMessage message = new MqttMessage(payload.getBytes());
            message.setQos(1);
            // MqttClient.publish(topic, message) is void in Paho 1.2.x; use topic.publish for delivery token.
            IMqttDeliveryToken token = mqttClient.getTopic(SMS_OUTBOUND_TOPIC).publish(message);
            token.waitForCompletion(5000);
            System.out.println(
                    " [MQTT] Published to " + SMS_OUTBOUND_TOPIC + " (priority=" + safePriority + ") for ***"
                            + tenDigit.substring(Math.max(0, tenDigit.length() - 4)));
            return true;
        } catch (MqttException e) {
            System.err.println(" [MQTT] Failed to publish SMS to GSM module: " + e.getMessage());
            return false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println(" [MQTT] SMS publish interrupted: " + e.getMessage());
            return false;
        }
    }

    @PreDestroy
    public void cleanup() {
        try {
            if (mqttClient.isConnected()) {
                mqttClient.disconnect();
            }
            mqttConnected.set(false);
        } catch (MqttException e) {
            e.printStackTrace();
        }
    }
}
