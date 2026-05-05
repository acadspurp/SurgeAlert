package com.surgealert;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync; // IMPORT THIS
import org.springframework.scheduling.annotation.EnableScheduling;

import java.net.URI;

@SpringBootApplication
@EnableScheduling
@EnableAsync // ADD THIS LINE
public class SurgeAlertApplication {
    public static void main(String[] args) {
        normalizeDatasourceUrl();
        SpringApplication.run(SurgeAlertApplication.class, args);
    }

    /**
     * Accept common cloud DATABASE_URL formats (e.g. postgres://...) and convert them
     * to Spring-compatible JDBC URLs before DataSource auto-configuration runs.
     */
    private static void normalizeDatasourceUrl() {
        String raw = firstNonBlank(
                System.getenv("SPRING_DATASOURCE_URL"),
                System.getenv("DATABASE_URL"),
                System.getenv("JDBC_DATABASE_URL")
        );
        if (raw == null) {
            String fallback = "jdbc:mysql://localhost:3306/surgealert_db?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true";
            System.setProperty("spring.datasource.url", fallback);
            if (System.getProperty("spring.datasource.driver-class-name") == null) {
                System.setProperty("spring.datasource.driver-class-name", "com.mysql.cj.jdbc.Driver");
            }
            return;
        }

        String trimmed = raw.trim();
        if (trimmed.startsWith("jdbc:")) {
            System.setProperty("spring.datasource.url", trimmed);
            return;
        }

        String jdbcUrl = toJdbcUrl(trimmed);
        if (jdbcUrl == null) return;

        System.setProperty("spring.datasource.url", jdbcUrl);

        // Infer driver for non-jdbc URL sources to bypass Boot's URL driver guessing failure.
        if (jdbcUrl.startsWith("jdbc:postgresql:")) {
            System.setProperty("spring.datasource.driver-class-name", "org.postgresql.Driver");
        } else if (jdbcUrl.startsWith("jdbc:mysql:")) {
            System.setProperty("spring.datasource.driver-class-name", "com.mysql.cj.jdbc.Driver");
        }
    }

    private static String toJdbcUrl(String rawUrl) {
        try {
            if (rawUrl.startsWith("postgres://") || rawUrl.startsWith("postgresql://")) {
                URI uri = URI.create(rawUrl);
                applyCredentials(uri.getUserInfo());
                String host = uri.getHost();
                int port = uri.getPort() > 0 ? uri.getPort() : 5432;
                String db = uri.getPath() != null ? uri.getPath() : "";
                String query = uri.getQuery();
                return "jdbc:postgresql://" + host + ":" + port + db + (query != null && !query.isBlank() ? "?" + query : "");
            }
            if (rawUrl.startsWith("mysql://")) {
                URI uri = URI.create(rawUrl);
                applyCredentials(uri.getUserInfo());
                String host = uri.getHost();
                int port = uri.getPort() > 0 ? uri.getPort() : 3306;
                String db = uri.getPath() != null ? uri.getPath() : "";
                String query = uri.getQuery();
                return "jdbc:mysql://" + host + ":" + port + db + (query != null && !query.isBlank() ? "?" + query : "");
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isBlank()) return value;
        }
        return null;
    }

    private static void applyCredentials(String userInfo) {
        if (userInfo == null || userInfo.isBlank()) return;
        String[] parts = userInfo.split(":", 2);
        if (parts.length > 0 && !parts[0].isBlank() && System.getProperty("spring.datasource.username") == null) {
            System.setProperty("spring.datasource.username", parts[0]);
        }
        if (parts.length > 1 && System.getProperty("spring.datasource.password") == null) {
            System.setProperty("spring.datasource.password", parts[1]);
        }
    }
}