package com.surgealert.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;

import java.io.IOException;

@Configuration
public class FirebaseConfig {

    // This reads the value from application.properties
    @Value("${app.firebase-configuration-file}")
    private Resource serviceAccountResource;

    @Bean
    public FirebaseApp firebaseApp() throws IOException {
        // .getInputStream() works regardless of whether the file is 
        // in resources (classpath) or a specific folder on your computer
        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(serviceAccountResource.getInputStream()))
                .build();

        if (FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.initializeApp(options);
        } else {
            return FirebaseApp.getInstance();
        }
    }
}