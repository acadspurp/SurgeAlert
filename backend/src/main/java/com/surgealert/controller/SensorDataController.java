package com.surgealert.controller;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.service.CanaryRolloutService;
import com.surgealert.service.CriticalAlertApprovalService;
import com.surgealert.service.AlertConfidenceService;
import com.surgealert.service.EmailService;
import com.surgealert.service.NotificationService;
import com.surgealert.service.ResidentService;
import com.surgealert.service.SensorDataService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sensor-data")
@CrossOrigin(origins = "*")
public class SensorDataController {

    private final SensorDataService sensorDataService;
    private final NotificationService notificationService;
    private final ResidentService residentService;
    private final EmailService emailService;
    private final CanaryRolloutService canaryRolloutService;
    private final CriticalAlertApprovalService criticalAlertApprovalService;
    private final AlertConfidenceService alertConfidenceService;

    @Value("${surgealert.reports.max-range-days:31}")
    private int maxReportRangeDays;

    // --- LIVE IMAGE STORAGE (Held in RAM) ---
    // We keep this for speed, but we will add a fallback to the DB
    public static String currentImageBase64 = "";

    // --- SECURITY KEY (Must match Python settings.py) ---
    private static final String SECRET_API_KEY = System.getenv().getOrDefault("EDGE_API_KEY", "");

    public SensorDataController(SensorDataService sensorDataService,
                                NotificationService notificationService,
                                ResidentService residentService,
                                EmailService emailService,
                                CanaryRolloutService canaryRolloutService,
                                CriticalAlertApprovalService criticalAlertApprovalService,
                                AlertConfidenceService alertConfidenceService) {
        this.sensorDataService = sensorDataService;
        this.notificationService = notificationService;
        this.residentService = residentService;
        this.emailService = emailService;
        this.canaryRolloutService = canaryRolloutService;
        this.criticalAlertApprovalService = criticalAlertApprovalService;
        this.alertConfidenceService = alertConfidenceService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> saveSensorData(
            @RequestHeader(value = "X-Edge-ApiKey", required = false) String apiKey,
            @RequestHeader(value = "X-Sensor-Id", required = false) String sensorId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole,
            @RequestBody SensorDataDTO dto) {

        // 1. SECURITY CHECK
        if (apiKey == null || !apiKey.equals(SECRET_API_KEY)) {
            return ResponseEntity.status(403).body(Map.of("error", "Unauthorized"));
        }

        // 2. Save Image to Memory (for Live Feed)
        // Also saves to DB via service if DTO has it
        if (dto.getSnapshotBase64() != null && !dto.getSnapshotBase64().isEmpty()) {
            currentImageBase64 = dto.getSnapshotBase64();
        }

        // 3. Save Data to Database
        SensorData savedData = sensorDataService.saveSensorData(dto);

        Map<String, Object> response = new HashMap<>();
        response.put("saved_id", savedData.getId());
        response.put("status", "success");
        response.put("canary", canaryRolloutService.isCanaryTraffic(sensorId, userRole));

        // 4. Check Logic for Alerts
        String level = savedData.getCurrentAlertLevel();
        
        // Get message template
        String messageToSend = notificationService.getAlertMessage(level, savedData.getWaterLevelM());

        // --- LOGIC: ONLY SEND IF YELLOW, ORANGE, OR RED ---
        // We strictly block "GREEN" here.
        boolean isCritical = level.equalsIgnoreCase("YELLOW") ||
                             level.equalsIgnoreCase("ORANGE") ||
                             level.equalsIgnoreCase("RED");

        if (isCritical && messageToSend != null) {
            AlertConfidenceService.ConfidenceResult confidence = alertConfidenceService.evaluate(
                    sensorId,
                    dto,
                    level,
                    savedData.getPredictedAlertLevel()
            );
            response.put("redConfidenceHigh", confidence.highConfidence());
            response.put("confidenceFailedGates", confidence.failedGates());

            if (criticalAlertApprovalService.requiresApproval(level) && !confidence.highConfidence()) {
                CriticalAlertApprovalService.PendingCriticalAlert pending = criticalAlertApprovalService
                        .createPendingAlert(sensorId == null ? "edge-unknown" : sensorId, messageToSend, savedData.getWaterLevelM());
                response.put("command", "AWAITING_HUMAN_CONFIRMATION");
                response.put("pendingAlertId", pending.id());
                response.put("pendingUntil", pending.expiresAt().toString());
                return ResponseEntity.ok(response);
            }
            // A. EMAIL (Server Side)
            List<String> emails = residentService.getAllActiveEmails();
            if (!emails.isEmpty()) {
                String subject = "SurgeAlert: " + level + " LEVEL WARNING";
                for (String email : emails) {
                    emailService.sendAlertEmail(email, subject, messageToSend, dto.getSnapshotBase64());
                }
            }

            // B. SMS Command (Tell Python to send SMS via Hardware)
            List<String> phoneNumbers = residentService.getAllActivePhoneNumbers();
            if (!phoneNumbers.isEmpty()) {
                response.put("command", "SEND_SMS");
                response.put("message", messageToSend);
                response.put("recipients", phoneNumbers);
            } else {
                response.put("command", "NO_RECIPIENTS");
            }
        } else {
            response.put("command", "NO_ACTION");
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/latest")
    public ResponseEntity<SensorDataDTO> getLatestSensorData() {
        SensorDataDTO latest = sensorDataService.getLatestSensorData();
        if (latest == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(latest);
    }

    @GetMapping("/recent")
    public ResponseEntity<?> getRecentSensorData(@RequestParam(defaultValue = "24") int hours) {
        return ResponseEntity.ok(sensorDataService.getRecentSensorData(hours));
    }

    @GetMapping("/audit")
    public ResponseEntity<Map<String, Object>> getAuditTrail() {
        // Assume Edge sends data every 10 seconds. In 24 hours, expected is 8640.
        long expected = 8640;
        long actual = sensorDataService.getRecentSensorData(24).size();
        long failed = expected - actual;
        if (failed < 0) failed = 0; // Edge might have started/stopped or sent extras
        if (actual > expected) expected = actual; // Prevent > 100%

        double successRate = expected > 0 ? ((double) actual / expected) * 100.0 : 0;
        
        Map<String, Object> audit = new HashMap<>();
        audit.put("expectedTransmissions", expected);
        audit.put("successfulTransmissions", actual);
        audit.put("failedAttempts", failed);
        audit.put("capturePercentage", String.format("%.2f%%", successRate));
        
        return ResponseEntity.ok(audit);
    }

    @GetMapping("/reports/export")
    public ResponseEntity<String> generateReport(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "true") boolean includeTelemetry,
            @RequestParam(defaultValue = "true") boolean includeAI) {
        DateRange parsedRange = null;
        if ((startDate != null && !startDate.isBlank()) || (endDate != null && !endDate.isBlank())) {
            if (startDate == null || startDate.isBlank() || endDate == null || endDate.isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Both startDate and endDate are required when filtering.");
            }
            try {
                parsedRange = parseUiDateRange(startDate, endDate);
                if (parsedRange.end.isBefore(parsedRange.start)) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("endDate must be on/after startDate.");
                }
                long days = ChronoUnit.DAYS.between(parsedRange.start, parsedRange.end) + 1;
                if (days > Math.max(1, maxReportRangeDays)) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body("Date range exceeds the allowed maximum of " + maxReportRangeDays + " days.");
                }
            } catch (Exception ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid date format. Use MM-DD-YYYY.");
            }
        }
        
        // "Good-looking" CSV template with a title block, summary rows, then data table.
        List<SensorDataDTO> all = sensorDataService.getRecentSensorData(24 * 30); // Max 30 days
        final DateRange range = parsedRange;

        // Filter by date range when provided (YYYY-MM-DD)
        List<SensorDataDTO> filtered = all.stream().filter(d -> {
            if (d == null || d.getTimestamp() == null) return false;
            if (range != null) {
                String dateStr = d.getTimestamp().toLocalDate().toString();
                return !(dateStr.compareTo(range.start.toString()) < 0 || dateStr.compareTo(range.end.toString()) > 0);
            }
            return true;
        }).toList();

        // Compute summary stats (telemetry only)
        Stats wlStats = new Stats();
        Stats frStats = new Stats();
        for (SensorDataDTO d : filtered) {
            if (includeTelemetry) {
                wlStats.accept(d.getWaterLevelM());
                frStats.accept(d.getSensorFlowRateMps());
            }
        }

        StringBuilder csv = new StringBuilder();
        csv.append(csvRow("SurgeAlert Report")).append("\n");
        csv.append(csvRow("")).append("\n");

        csv.append(csvRow("Metric", "Value")).append("\n");
        csv.append(csvRow("Generated At", java.time.LocalDateTime.now().toString())).append("\n");
        csv.append(csvRow("Date Range", (startDate == null || startDate.isBlank() ? "—" : startDate) + " to " + (endDate == null || endDate.isBlank() ? "—" : endDate))).append("\n");
        csv.append(csvRow("Rows Exported", String.valueOf(filtered.size()))).append("\n");

        if (includeTelemetry) {
            csv.append(csvRow("")).append("\n");
            csv.append(csvRow("Telemetry Summary", "")).append("\n");
            csv.append(csvRow("Water Level (m) - Min", wlStats.minStr(2))).append("\n");
            csv.append(csvRow("Water Level (m) - Avg", wlStats.avgStr(2))).append("\n");
            csv.append(csvRow("Water Level (m) - Max", wlStats.maxStr(2))).append("\n");
            csv.append(csvRow("Flow Rate (m/s) - Min", frStats.minStr(2))).append("\n");
            csv.append(csvRow("Flow Rate (m/s) - Avg", frStats.avgStr(2))).append("\n");
            csv.append(csvRow("Flow Rate (m/s) - Max", frStats.maxStr(2))).append("\n");
        }

        csv.append("\n");
        csv.append(csvRow("Data")).append("\n");

        // Header row
        StringBuilder header = new StringBuilder();
        header.append(csvCell("Timestamp"));
        if (includeTelemetry) {
            header.append(",").append(csvCell("Water Level (m)"))
                  .append(",").append(csvCell("Sensor Flow Rate (m/s)"))
                  .append(",").append(csvCell("Optical Flow Rate (m/s)"))
                  .append(",").append(csvCell("Current Alert Level"));
        }
        if (includeAI) {
            header.append(",").append(csvCell("Predicted Level (m)"));
        }
        csv.append(header).append("\n");

        for (SensorDataDTO d : filtered) {
            StringBuilder row = new StringBuilder();
            row.append(csvCell(d.getTimestamp().toString()));
            if (includeTelemetry) {
                row.append(",").append(csvCell(numOrBlank(d.getWaterLevelM())))
                   .append(",").append(csvCell(numOrBlank(d.getSensorFlowRateMps())))
                   .append(",").append(csvCell(numOrBlank(d.getImageFlowRateMps())))
                   .append(",").append(csvCell(d.getCurrentAlertLevel() != null ? d.getCurrentAlertLevel() : ""));
            }
            if (includeAI) {
                row.append(",").append(csvCell(numOrBlank(d.getPredictedLevel())));
            }
            csv.append(row).append("\n");
        }
        
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.add("Content-Disposition", "attachment; filename=\"SurgeAlert_Report.csv\"");
        headers.add("Content-Type", "text/csv; charset=UTF-8");
        
        return new ResponseEntity<>(csv.toString(), headers, org.springframework.http.HttpStatus.OK);
    }

    private static String numOrBlank(Double v) {
        return v == null ? "" : String.valueOf(v);
    }

    private static DateRange parseUiDateRange(String startDate, String endDate) {
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("MM-dd-yyyy");
        LocalDate start = LocalDate.parse(startDate, formatter);
        LocalDate end = LocalDate.parse(endDate, formatter);
        return new DateRange(start, end);
    }

    private static String csvRow(String... cols) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < cols.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(csvCell(cols[i] == null ? "" : cols[i]));
        }
        return sb.toString();
    }

    private static String csvCell(String raw) {
        String s = raw == null ? "" : raw;
        boolean needsQuotes = s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r");
        if (s.contains("\"")) s = s.replace("\"", "\"\"");
        return needsQuotes ? ("\"" + s + "\"") : s;
    }

    private static class Stats {
        private double min = Double.POSITIVE_INFINITY;
        private double max = Double.NEGATIVE_INFINITY;
        private BigDecimal sum = BigDecimal.ZERO;
        private long count = 0;

        void accept(Double v) {
            if (v == null) return;
            double d = v;
            if (Double.isNaN(d) || Double.isInfinite(d)) return;
            if (d < min) min = d;
            if (d > max) max = d;
            sum = sum.add(BigDecimal.valueOf(d));
            count++;
        }

        String minStr(int scale) {
            if (count == 0) return "—";
            return BigDecimal.valueOf(min).setScale(scale, RoundingMode.HALF_UP).toPlainString();
        }

        String maxStr(int scale) {
            if (count == 0) return "—";
            return BigDecimal.valueOf(max).setScale(scale, RoundingMode.HALF_UP).toPlainString();
        }

        String avgStr(int scale) {
            if (count == 0) return "—";
            return sum.divide(BigDecimal.valueOf(count), scale, RoundingMode.HALF_UP).toPlainString();
        }
    }

    private record DateRange(LocalDate start, LocalDate end) {}
}