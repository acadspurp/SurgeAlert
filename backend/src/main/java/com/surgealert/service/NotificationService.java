package com.surgealert.service;

import com.surgealert.entity.AlertTemplate;
import com.surgealert.repository.AlertTemplateRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class NotificationService {

    private final AlertTemplateRepository templateRepository;
    private final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);
    private final ZoneId zoneId = ZoneId.systemDefault();

    public NotificationService(AlertTemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    public String getAlertMessage(String level) {
        return getAlertMessage(level, null);
    }

    /**
     * Generates the outbound broadcast message for an alert level.
     *
     * Supported placeholders (preferred):
     * - {level}      -> water height (e.g., 18.2m)
     * - {waterLevel} -> alias of {level} for backward compatibility
     * - {status}     -> alert color/level (e.g., RED)
     * - {timestamp}  -> time recorded/sent (e.g., 2:15 PM)
     *
     * Legacy placeholders (supported):
     * - %s or [%s]   -> treated as {timestamp} for alert templates
     */
    public String getAlertMessage(String status, Double waterLevelM) {
        final String key = status == null ? "" : status.toUpperCase();
        return templateRepository.findByAlertType(key)
                .map(t -> {
                    String template = t.getTemplate() == null ? "" : t.getTemplate();

                    String timestamp = LocalDateTime.now(zoneId).format(formatter);
                    String levelText = waterLevelM == null ? "" : String.format(Locale.ENGLISH, "%.2fm", waterLevelM);

                    // Prefer curly-brace placeholders when present.
                    boolean hasCurly = template.contains("{");
                    boolean hasLegacyFormat = template.contains("%s");

                    String rendered;
                    if (hasCurly) {
                        Map<String, String> vars = new HashMap<>();
                        vars.put("status", key);
                        vars.put("level", levelText);
                        vars.put("waterLevel", levelText);
                        vars.put("timestamp", timestamp);
                        // Reserved for future per-recipient personalization (broadcast uses a shared message today).
                        vars.put("name", "");
                        rendered = applyVars(template, vars);
                    } else if (hasLegacyFormat) {
                        // Historical DB templates use [%s] to indicate timestamp, but String.format expects %s.
                        rendered = String.format(template, timestamp);
                    } else {
                        rendered = template;
                    }

                    // Timestamp integration: ensure alert broadcasts always include a timestamp.
                    // If the template already injected timestamp via {timestamp} or legacy %s, don't duplicate.
                    if (!rendered.contains(timestamp)) {
                        rendered = rendered.trim() + " at " + timestamp + ".";
                    }

                    return rendered;
                })
                .orElse(null);
    }

    public String getOtpMessage(String otpCode) {
        return templateRepository.findByAlertType("OTP")
                .map(t -> {
                    String template = t.getTemplate() == null ? "" : t.getTemplate();
                    if (template.contains("{")) {
                        Map<String, String> vars = new HashMap<>();
                        vars.put("otp", otpCode == null ? "" : otpCode);
                        vars.put("code", otpCode == null ? "" : otpCode);
                        return applyVars(template, vars);
                    }
                    return String.format(template, otpCode);
                })
                .orElse("Your OTP is: " + otpCode);
    }
    
    public String getRegistrationSuccessMessage() {
        return templateRepository.findByAlertType("REGISTER")
                .map(AlertTemplate::getTemplate)
                .orElse("SurgeAlert: Welcome! Matagumpay ang iyong pag-subscribe sa Marulas Flood Alert System. Makakatanggap ka na ng mga SMS alerts kung may banta ng baha.");
    }

    public String getManualMessage(String customMessage) {
        return templateRepository.findByAlertType("MANUAL")
                .map(t -> {
                    String template = t.getTemplate() == null ? "" : t.getTemplate();
                    String timestamp = LocalDateTime.now(zoneId).format(formatter);
                    if (template.contains("{")) {
                        Map<String, String> vars = new HashMap<>();
                        vars.put("message", customMessage == null ? "" : customMessage);
                        vars.put("timestamp", timestamp);
                        vars.put("status", "MANUAL");
                        return ensureTimestamp(applyVars(template, vars), timestamp);
                    }
                    // Legacy: first %s message, second %s timestamp
                    return ensureTimestamp(String.format(template, customMessage, timestamp), timestamp);
                })
                .orElse(customMessage);
    }

    private static String ensureTimestamp(String rendered, String timestamp) {
        if (rendered == null) return null;
        if (timestamp == null || timestamp.isBlank()) return rendered;
        if (rendered.contains(timestamp)) return rendered;
        return rendered.trim() + " at " + timestamp + ".";
    }

    private static String applyVars(String template, Map<String, String> vars) {
        String out = template;
        for (Map.Entry<String, String> e : vars.entrySet()) {
            String k = e.getKey();
            String v = e.getValue() == null ? "" : e.getValue();
            out = out.replace("{" + k + "}", v);
        }
        return out;
    }
}