package com.surgealert.config;

import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

@Configuration
public class MqttConfig {

    @Value("${mqtt.broker.url}")
    private String brokerUrl;

    @Value("${mqtt.broker.username}")
    private String username;

    @Value("${mqtt.broker.password}")
    private String password;

    @Value("${mqtt.client.id}")
    private String clientId;

    @Bean
    public MqttConnectOptions mqttConnectOptions() {
        MqttConnectOptions options = new MqttConnectOptions();
        options.setUserName(username);
        options.setPassword(password.toCharArray());
        options.setCleanSession(true);
        options.setAutomaticReconnect(true);
        options.setConnectionTimeout(30); // Increased timeout for cloud
        options.setKeepAliveInterval(60);

        // Required for HiveMQ Cloud (ssl://)
        if (brokerUrl != null && brokerUrl.startsWith("ssl://")) {
            try {
                options.setSocketFactory(javax.net.ssl.SSLSocketFactory.getDefault());
            } catch (Exception e) {
                System.err.println(" [MQTT] Failed to set SSL Socket Factory: " + e.getMessage());
            }
        }
        
        return options;
    }

    @Bean
    public MqttClient mqttClient() throws MqttException {
        // Appending a random number to avoid Client ID collision if you run multiple instances
        String uniqueClientId = clientId + "-" + System.currentTimeMillis();
        return new MqttClient(brokerUrl, uniqueClientId, new MemoryPersistence());
    }
}
