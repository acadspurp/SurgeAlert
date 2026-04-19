package com.surgealert.controller;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.service.AlertDispatchService;
import com.surgealert.service.CameraImageCache;
import com.surgealert.service.SensorDataService;
import com.surgealert.util.CsvEscaper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sensor-data")
public class SensorDataController {

    private final SensorDataService sensorDataService;
    private final AlertDispatchService alertDispatchService;
    private final CameraImageCache cameraImageCache;

    private final int exportMaxRows;
    private static final int MAX_EXPORT_RANGE_DAYS = 90;

    public SensorDataController(
            SensorDataService sensorDataService,
            AlertDispatchService alertDispatchService,
            CameraImageCache cameraImageCache,
            @Value("${surgealert.export.max-rows:50000}") int exportMaxRows) {
        this.sensorDataService = sensorDataService;
        this.alertDispatchService = alertDispatchService;
        this.cameraImageCache = cameraImageCache;
        this.exportMaxRows = Math.max(100, exportMaxRows);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> saveSensorData(@RequestBody SensorDataDTO dto) {
        if (dto.getSnapshotBase64() != null && !dto.getSnapshotBase64().isEmpty()) {
            cameraImageCache.setLatestBase64(dto.getSnapshotBase64());
        }

        SensorData savedData = sensorDataService.saveSensorData(dto);

        Map<String, Object> response = new HashMap<>();
        response.put("saved_id", savedData.getId());
        response.put("status", "success");

        alertDispatchService.handleAfterSave(savedData, dto, response);
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

    @GetMapping("/reports/export")
    public ResponseEntity<String> generateReport(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "true") boolean includeTelemetry,
            @RequestParam(defaultValue = "true") boolean includeAI) {

        LocalDateTime start;
        LocalDateTime end;
        try {
            if (startDate != null && !startDate.isBlank() && endDate != null && !endDate.isBlank()) {
                LocalDate sd = LocalDate.parse(startDate);
                LocalDate ed = LocalDate.parse(endDate);
                if (ed.isBefore(sd)) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("endDate must be on or after startDate");
                }
                if (sd.plusDays(MAX_EXPORT_RANGE_DAYS).isBefore(ed)) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body("Date range too large (max " + MAX_EXPORT_RANGE_DAYS + " days)");
                }
                start = sd.atStartOfDay();
                end = ed.atTime(LocalTime.MAX);
            } else if ((startDate != null && !startDate.isBlank()) != (endDate != null && !endDate.isBlank())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Provide both startDate and endDate (YYYY-MM-DD), or neither for default window");
            } else {
                end = LocalDateTime.now();
                start = end.minusDays(30);
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid date format. Use YYYY-MM-DD.");
        }

        List<SensorDataDTO> rows = sensorDataService.getSensorDataForExport(start, end, exportMaxRows);

        StringBuilder csv = new StringBuilder();
        csv.append(CsvEscaper.cell("Timestamp"));
        if (includeTelemetry) {
            csv.append(",").append(CsvEscaper.cell("WaterLevel(m)"))
                    .append(",").append(CsvEscaper.cell("SensorFlowRate(m/s)"))
                    .append(",").append(CsvEscaper.cell("OpticalFlowRate(m/s)"))
                    .append(",").append(CsvEscaper.cell("CurrentAlertLevel"));
        }
        if (includeAI) {
            csv.append(",").append(CsvEscaper.cell("PredictedLevel(m)"));
        }
        csv.append("\n");

        for (SensorDataDTO d : rows) {
            if (d == null) {
                continue;
            }
            csv.append(CsvEscaper.cell(d.getTimestamp() != null ? d.getTimestamp().toString() : ""));
            if (includeTelemetry) {
                csv.append(",").append(CsvEscaper.cell(d.getWaterLevelM() != null ? String.valueOf(d.getWaterLevelM()) : ""))
                        .append(",").append(CsvEscaper.cell(d.getSensorFlowRateMps() != null ? String.valueOf(d.getSensorFlowRateMps()) : ""))
                        .append(",").append(CsvEscaper.cell(d.getImageFlowRateMps() != null ? String.valueOf(d.getImageFlowRateMps()) : ""))
                        .append(",").append(CsvEscaper.cell(d.getCurrentAlertLevel()));
            }
            if (includeAI) {
                csv.append(",").append(CsvEscaper.cell(d.getPredictedLevel() != null ? String.valueOf(d.getPredictedLevel()) : ""));
            }
            csv.append("\n");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.add("Content-Disposition", "attachment; filename=\"SurgeAlert_Report.csv\"");
        headers.add("Content-Type", "text/csv; charset=UTF-8");

        return new ResponseEntity<>(csv.toString(), headers, HttpStatus.OK);
    }
}
