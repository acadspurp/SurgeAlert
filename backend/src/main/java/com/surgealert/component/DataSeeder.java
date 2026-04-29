package com.surgealert.component;

import com.surgealert.entity.SensorData;
import com.surgealert.repository.SensorDataRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private SensorDataRepository sensorDataRepository;

    @Value("${surgealert.demo.seed-historical-data:true}")
    private boolean seedHistoricalData;

    @Override
    public void run(String... args) throws Exception {
        if (!seedHistoricalData) {
            return;
        }

        System.out.println("Purging existing sensor data to make room for massive historical dataset...");
        sensorDataRepository.deleteAllInBatch();

        System.out.println("Starting massive historical data seeder (March 1 to Now)...");
        
        List<SensorData> dataBatch = new ArrayList<>();
        LocalDateTime current = LocalDateTime.of(2026, 3, 1, 0, 0);
        LocalDateTime now = LocalDateTime.now();

        int batchSize = 1000;
        
        while (current.isBefore(now)) {
            SensorData data = new SensorData();
            data.setTimestamp(current);
            
            // Generate some realistic looking waves using sin/cos and noise
            double hoursPassed = current.toEpochSecond(ZoneOffset.UTC) / 3600.0;
            double tide = Math.sin((hoursPassed / 12.42) * 2 * Math.PI) * 1.5;
            double noise = (Math.random() - 0.5) * 0.2;
            
            double wl = Math.max(0, 2.5 + tide + noise);
            double fr = Math.max(0, 1.0 + (tide * 0.2) + (noise * 0.5));
            
            data.setWaterLevelM(wl);
            data.setSensorFlowRateMps(fr);
            data.setImageFlowRateMps(fr * 1.1 + (Math.random() - 0.5) * 0.1);
            data.setImageRiseRateMps(0.0);
            
            String status = "GREEN";
            if (wl >= 8.5) status = "RED";
            else if (wl >= 7.0) status = "ORANGE";
            else if (wl >= 6.0) status = "YELLOW";
            data.setCurrentAlertLevel(status);
            
            double pred = wl + (Math.random() - 0.5) * 0.3;
            data.setPredictedLevel(pred);
            
            String predStatus = "GREEN";
            if (pred >= 8.5) predStatus = "RED";
            else if (pred >= 7.0) predStatus = "ORANGE";
            else if (pred >= 6.0) predStatus = "YELLOW";
            data.setPredictedAlertLevel(predStatus);
            
            dataBatch.add(data);
            
            if (dataBatch.size() >= batchSize) {
                sensorDataRepository.saveAll(dataBatch);
                dataBatch.clear();
            }
            
            // 10 minutes interval
            current = current.plusMinutes(10);
        }
        
        if (!dataBatch.isEmpty()) {
            sensorDataRepository.saveAll(dataBatch);
        }
        
        System.out.println("Massive historical data seeding completed successfully.");
    }
}
