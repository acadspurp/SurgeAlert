package com.surgealert.controller;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.service.AlertSmsDispatchService;
import com.surgealert.service.CriticalAlertApprovalService;
import com.surgealert.service.ManualOverrideService;
import com.surgealert.service.MqttSubscriberService;
import com.surgealert.service.OverrideSmsBroadcastService;
import com.surgealert.service.OverrideSmsBroadcastService.OverrideBroadcast;
import com.surgealert.service.SensorDataService;
import com.surgealert.util.AlertLevelUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Head-admin alert controls (requires JWT on /api/admin/**, not the public API chain).
 */
@RestController
@RequestMapping("/api/admin/alerts")
@CrossOrigin(origins = "*")
public class AdminAlertController {

    private final ManualOverrideService manualOverrideService;
    private final CriticalAlertApprovalService criticalAlertApprovalService;
    private final AlertSmsDispatchService alertSmsDispatchService;
    private final SensorDataService sensorDataService;
    private final MqttSubscriberService mqttSubscriberService;
    private final OverrideSmsBroadcastService overrideSmsBroadcastService;

    public AdminAlertController(
            ManualOverrideService manualOverrideService,
            CriticalAlertApprovalService criticalAlertApprovalService,
            AlertSmsDispatchService alertSmsDispatchService,
            SensorDataService sensorDataService,
            MqttSubscriberService mqttSubscriberService,
            OverrideSmsBroadcastService overrideSmsBroadcastService) {
        this.manualOverrideService = manualOverrideService;
        this.criticalAlertApprovalService = criticalAlertApprovalService;
        this.alertSmsDispatchService = alertSmsDispatchService;
        this.sensorDataService = sensorDataService;
        this.mqttSubscriberService = mqttSubscriberService;
        this.overrideSmsBroadcastService = overrideSmsBroadcastService;
    }

    @PostMapping("/override")
    public ResponseEntity<Map<String, Object>> setOverride(@RequestBody Map<String, String> body) {
        String level = body.get("level");
        String reason = body.get("reason");
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "success");
        response.put("smsRecipients", 0);
        response.put("mqttConnected", mqttSubscriberService.isMqttConnected());

        if (level == null || level.trim().isEmpty() || level.equalsIgnoreCase("NORMAL")) {
            manualOverrideService.clearOverride();
            overrideSmsBroadcastService.clearAnyPending();
            UserController.addLog("Admin cleared manual override. System returned to AUTO.");
            return ResponseEntity.ok(response);
        }

        String normalized = AlertLevelUtils.normalizeOverrideLevel(level);
        if (normalized == null) {
            response.put("status", "error");
            response.put("smsWarning", "Unsupported override level. Use NORMAL, YELLOW, ORANGE, or RED.");
            return ResponseEntity.badRequest().body(response);
        }
        manualOverrideService.setOverrideLevel(normalized);
        UserController.addLog("Admin invoked manual override to " + normalized + ".");

        SensorDataDTO latest = sensorDataService.getLatestSensorData();
        Double waterLevelM = latest != null ? latest.getWaterLevelM() : null;
        String message = alertSmsDispatchService.composeManualOverrideMessage(normalized, waterLevelM, reason);
        OverrideBroadcast pending = overrideSmsBroadcastService.setPending(normalized, message);
        AtomicInteger published = new AtomicInteger(0);
        int attempted = alertSmsDispatchService.dispatchManualOverrideMessage(
                message,
                (phone, msg) -> {
                    if (mqttSubscriberService.publishSmsToGsm(phone, msg, "alert")) {
                        published.incrementAndGet();
                    }
                });
        int smsRecipients = published.get();
        if (smsRecipients > 0) {
            alertSmsDispatchService.markManualOverrideDispatched(normalized);
        }
        int totalPhones = alertSmsDispatchService.getActiveSubscriberCount();
        if (smsRecipients >= totalPhones && totalPhones > 0) {
            overrideSmsBroadcastService.clearPending(pending.id());
        }
        response.put("smsRecipients", smsRecipients);
        if (smsRecipients == 0) {
            if (attempted == 0) {
                response.put(
                        "smsWarning",
                        "Override saved but SMS was not sent (no active subscribers).");
            } else {
                response.put(
                        "smsWarning",
                        "Override saved. MQTT publish failed — Pi will retry via edge sync on next sync.");
            }
        } else if (!mqttSubscriberService.isMqttConnected()) {
            response.put(
                    "smsWarning",
                    "Override saved. SMS queued via GSM fallback but MQTT is disconnected — ensure the Pi is running main_loop.");
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/red/pending/{id}/approve")
    public ResponseEntity<?> approveRedAlert(@PathVariable String id) {
        CriticalAlertApprovalService.PendingCriticalAlert pending = criticalAlertApprovalService.approve(id);
        if (pending == null) {
            return ResponseEntity.notFound().build();
        }
        int smsRecipients = 0;
        if ("APPROVED".equals(pending.status())) {
            smsRecipients = alertSmsDispatchService.dispatchApprovedRedAlert(
                    pending,
                    (phone, msg) -> mqttSubscriberService.publishSmsToGsm(phone, msg, "alert"));
        }
        UserController.addLog(
                "RED alert approval " + id + " set to " + pending.status() + " (SMS to " + smsRecipients + ").");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", pending.id());
        body.put("status", pending.status());
        body.put("smsRecipients", smsRecipients);
        if (smsRecipients == 0 && "APPROVED".equals(pending.status())) {
            body.put("smsWarning", "Approved but SMS was not sent (no subscribers or delivery failed).");
        }
        return ResponseEntity.ok(body);
    }

    @PostMapping("/red/pending/{id}/reject")
    public ResponseEntity<?> rejectRedAlert(@PathVariable String id) {
        CriticalAlertApprovalService.PendingCriticalAlert pending = criticalAlertApprovalService.reject(id);
        if (pending == null) {
            return ResponseEntity.notFound().build();
        }
        UserController.addLog("RED alert approval " + id + " set to " + pending.status() + ".");
        return ResponseEntity.ok(pending);
    }
}
