package com.surgealert.controller;

import com.surgealert.repository.UserRepository;
import com.surgealert.service.MqttSubscriberService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/public/system")
@CrossOrigin(origins = "*")
public class SystemStatusController {

    private final UserRepository userRepository;
    private final MqttSubscriberService mqttSubscriberService;

    @Value("${worldtides.api.key:MISSING}")
    private String tideKey;

    @Value("${spring.datasource.url}")
    private String dbUrl;

    @Value("${mqtt.topic.sensor:surgealert/sensor-data}")
    private String mqttTopic;

    public SystemStatusController(UserRepository userRepository, MqttSubscriberService mqttSubscriberService) {
        this.userRepository = userRepository;
        this.mqttSubscriberService = mqttSubscriberService;
    }

    @GetMapping("/diagnostic")
    public ResponseEntity<Map<String, Object>> getDiagnostic() {
        Map<String, Object> status = new HashMap<>();
        
        // 1. Check Database
        try {
            long userCount = userRepository.count();
            status.put("databaseConnection", "CONNECTED");
            status.put("databaseUserCount", userCount);
        } catch (Exception e) {
            status.put("databaseConnection", "FAILED: " + e.getMessage());
        }

        // 2. Check Environment Variables
        status.put("tideApiKeyStatus", (tideKey.equals("MISSING") || tideKey.isBlank()) ? "MISSING" : "CONFIGURED");
        status.put("databaseUrl", dbUrl);
        status.put("mqttTopic", mqttTopic);
        status.put("mqttConnected", mqttSubscriberService.isMqttConnected());
        
        // 3. System Info
        status.put("javaVersion", System.getProperty("java.version"));
        status.put("osName", System.getProperty("os.name"));
        status.put("timestamp", java.time.LocalDateTime.now().toString());

        return ResponseEntity.ok(status);
    }
}
