package com.surgealert.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;

/**
 * Runs before the application context so JPA {@code AttributeConverter} instances (instantiated by
 * Hibernate, not Spring) can read the same secret as {@code application.properties} via
 * {@link System#getProperty(String)}.
 */
public class SurgeEncryptionEnvironmentPostProcessor implements EnvironmentPostProcessor {

    public static final String PROPERTY = "surgealert.encryption.secret";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String value = environment.getProperty(PROPERTY);
        if (value != null && !value.isBlank()) {
            System.setProperty(PROPERTY, value);
        } else {
            // So Hibernate-instantiated converters still see the same default as application.properties
            System.setProperty(PROPERTY, "SurgeAlertSecret");
        }
    }
}
