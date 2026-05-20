package com.surgealert.controller;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.service.CanaryRolloutService;
import com.surgealert.service.CriticalAlertApprovalService;
import com.surgealert.service.AlertConfidenceService;
import com.surgealert.service.AlertSmsDispatchService;
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
    private final CanaryRolloutService canaryRolloutService;
    private final CriticalAlertApprovalService criticalAlertApprovalService;
    private final AlertConfidenceService alertConfidenceService;
    private final AlertSmsDispatchService alertSmsDispatchService;

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
                                AlertConfidenceService alertConfidenceService,
                                AlertSmsDispatchService alertSmsDispatchService) {
        this.sensorDataService = sensorDataService;
        this.notificationService = notificationService;
        this.residentService = residentService;
        this.canaryRolloutService = canaryRolloutService;
        this.criticalAlertApprovalService = criticalAlertApprovalService;
        this.alertConfidenceService = alertConfidenceService;
        this.alertSmsDispatchService = alertSmsDispatchService;
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
        if (savedData == null) {
            Map<String, Object> ignoredResponse = new HashMap<>();
            ignoredResponse.put("status", "ignored");
            ignoredResponse.put("reason", "Ghost value / noise (below 0.10m) blocked by Data Guard.");
            return ResponseEntity.ok(ignoredResponse);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("saved_id", savedData.getId());
        response.put("status", "success");
        response.put("canary", canaryRolloutService.isCanaryTraffic(sensorId, userRole));

        String level = savedData.getCurrentAlertLevel();
        boolean dispatched = alertSmsDispatchService.dispatchIfLevelChanged(
                sensorId, savedData, dto, null);
        if (dispatched) {
            response.put("command", "SMS_DISPATCHED");
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
            @RequestParam(defaultValue = "true") boolean includeRaw,
            @RequestParam(defaultValue = "true") boolean includeCalculated,
            @RequestParam(defaultValue = "true") boolean includeAlerts,
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
        
        List<SensorDataDTO> all = sensorDataService.getRecentSensorData(24 * 30);
        final DateRange range = parsedRange;

        List<SensorDataDTO> filtered = all.stream().filter(d -> {
            if (d == null || d.getTimestamp() == null) return false;
            if (range != null) {
                String dateStr = d.getTimestamp().toLocalDate().toString();
                return !(dateStr.compareTo(range.start.toString()) < 0 || dateStr.compareTo(range.end.toString()) > 0);
            }
            return true;
        }).toList();

        // Summary Stats
        Stats wlStats = new Stats();
        Stats frStats = new Stats();
        for (SensorDataDTO d : filtered) {
            wlStats.accept(d.getWaterLevelM());
            frStats.accept(d.getSensorFlowRate());
        }

        StringBuilder csv = new StringBuilder();
        csv.append(csvRow("SurgeAlert Detailed Export Report")).append("\n");
        csv.append(csvRow("Generated At", java.time.LocalDateTime.now(java.time.ZoneId.of("Asia/Manila")).toString())).append("\n");
        csv.append(csvRow("Date Range", (startDate == null || startDate.isBlank() ? "Entire History" : startDate + " to " + endDate))).append("\n");
        csv.append(csvRow("Total Records", String.valueOf(filtered.size()))).append("\n\n");

        if (includeCalculated || includeRaw) {
            csv.append(csvRow("Summary Statistics (Last 30 Days/Range)")).append("\n");
            if (includeCalculated) {
                csv.append(csvRow("Water Level (m) [Min/Avg/Max]", wlStats.minStr(2), wlStats.avgStr(2), wlStats.maxStr(2))).append("\n");
            }
            if (includeRaw) {
                csv.append(csvRow("Flow Rate (m/s) [Min/Avg/Max]", frStats.minStr(2), frStats.avgStr(2), frStats.maxStr(2))).append("\n");
            }
            csv.append("\n");
        }

        // Header
        StringBuilder header = new StringBuilder();
        header.append(csvCell("Timestamp"));
        if (includeCalculated) header.append(",").append(csvCell("Water Level (m)"));
        if (includeRaw) {
            header.append(",").append(csvCell("Radar Flow (m/s)"))
                  .append(",").append(csvCell("Optical Flow (m/s)"))
                  .append(",").append(csvCell("Fused Flow (m/s)"))
                  .append(",").append(csvCell("Rise Rate (m/h)"))
                  .append(",").append(csvCell("Tide_Height_m"))
                  .append(",").append(csvCell("Rain_mm"))
                  .append(",").append(csvCell("Pressure_hPa"))
                  .append(",").append(csvCell("Wind_Speed"));
        }
        if (includeAlerts) header.append(",").append(csvCell("Current Alert Status"));
        if (includeAI) {
            header.append(",").append(csvCell("AI Predicted Level (m)"))
                  .append(",").append(csvCell("AI Predicted Status"));
        }
        csv.append(header).append("\n");

        for (SensorDataDTO d : filtered) {
            StringBuilder row = new StringBuilder();
            row.append(csvCell(d.getTimestamp().toString()));
            if (includeCalculated) row.append(",").append(csvCell(numOrBlank(d.getWaterLevelM())));
            if (includeRaw) {
                row.append(",").append(csvCell(numOrBlank(d.getSensorFlowRate())))
                   .append(",").append(csvCell(numOrBlank(d.getImageFlowRate())))
                   .append(",").append(csvCell(numOrBlank(d.getFusedFlowRate())))
                   .append(",").append(csvCell(numOrBlank(d.getRiseRate())))
                   .append(",").append(csvCell(numOrBlank(d.getTideHeightM())))
                   .append(",").append(csvCell(numOrBlank(d.getRainMm())))
                   .append(",").append(csvCell(numOrBlank(d.getPressureHpa())))
                   .append(",").append(csvCell(numOrBlank(d.getWindSpeedKph())));
            }
            if (includeAlerts) row.append(",").append(csvCell(d.getCurrentAlertLevel()));
            if (includeAI) {
                row.append(",").append(csvCell(numOrBlank(d.getPredictedLevel())))
                   .append(",").append(csvCell(d.getPredictedAlertLevel()));
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