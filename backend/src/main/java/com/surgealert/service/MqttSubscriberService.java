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

@Service
public class MqttSubscriberService {

    private final MqttClient mqttClient;
    private final MqttConnectOptions mqttConnectOptions;
    private final SensorDataService sensorDataService;
    private final AlertDispatchService alertDispatchService;
    private final CameraImageCache cameraImageCache;
    private final ObjectMapper objectMapper;

    @Value("${mqtt.topic.sensor}")
    private String sensorTopic;

    public MqttSubscriberService(
            MqttClient mqttClient,
            MqttConnectOptions mqttConnectOptions,
            SensorDataService sensorDataService,
            AlertDispatchService alertDispatchService,
            CameraImageCache cameraImageCache,
            ObjectMapper objectMapper) {
        this.mqttClient = mqttClient;
        this.mqttConnectOptions = mqttConnectOptions;
        this.sensorDataService = sensorDataService;
        this.alertDispatchService = alertDispatchService;
        this.cameraImageCache = cameraImageCache;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        try {
            mqttClient.connect(mqttConnectOptions);
            System.out.println(" [MQTT] Connected to broker at " + mqttClient.getServerURI());

            mqttClient.subscribe(sensorTopic, (topic, message) -> {
                try {
                    String payload = new String(message.getPayload());
                    SensorDataDTO dto = objectMapper.readValue(payload, SensorDataDTO.class);

                    if (dto.getSnapshotBase64() != null && !dto.getSnapshotBase64().isEmpty()) {
                        cameraImageCache.setLatestBase64(dto.getSnapshotBase64());
                    }

                    SensorData savedData = sensorDataService.saveSensorData(dto);
                    alertDispatchService.handleAfterSave(savedData, dto, null);

                    System.out.println(" [MQTT] Processed sensor payload — alert: " + savedData.getCurrentAlertLevel());
                } catch (Exception e) {
                    System.err.println(" [MQTT] Error processing message: " + e.getMessage());
                }
            });
            System.out.println(" [MQTT] Subscribed to topic: " + sensorTopic);
        } catch (MqttException e) {
            System.err.println(" [MQTT] FATAL: Could not connect: " + e.getMessage());
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
