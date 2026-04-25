package com.surgealert.config;

import com.surgealert.entity.AlertTemplate;
import com.surgealert.repository.AlertTemplateRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class TemplateSeeder implements CommandLineRunner {

    private final AlertTemplateRepository repository;

    public TemplateSeeder(AlertTemplateRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... args) throws Exception {
        // Only insert defaults if the table is empty
        if (repository.count() == 0) {
            
            repository.save(new AlertTemplate("YELLOW", 
                "SurgeAlert: YELLOW ALERT (Babala). Mabilis na pagtaas ng tubig sa Tullahan River. Maging handa at subaybayan ang mga anunsyo. [%s] - Marulas BDRRMO"));
            
            repository.save(new AlertTemplate("ORANGE", 
                "SurgeAlert: ORANGE ALERT (Maghanda sa Paglikas). Kritikal ang antas ng tubig sa Tullahan River. Ang mga nasa mababang lugar ay pinapayuhang lumikas na. [%s] - Marulas BDRRMO"));
            
            repository.save(new AlertTemplate("RED", 
                "SurgeAlert: RED ALERT (LUMIKAS LAHAT). Mapanganib ang antas ng tubig sa Tullahan River. Mahigpit na ipinag-uutos ang paglikas ng lahat ng residente. Pumunta sa pinakamalapit na evacuation center. [%s] - Marulas BDRRMO"));
            
            repository.save(new AlertTemplate("GREEN", 
                "SurgeAlert: ALL-CLEAR. Bumalik na sa normal ang antas ng tubig sa Tullahan River. Ligtas nang bumalik sa inyong mga tahanan. Manatiling maingat. [%s] - Marulas BDRRMO"));
            
            repository.save(new AlertTemplate("OTP", 
                "Ang iyong SurgeAlert OTP ay: [%s]. Huwag itong ibahagi sa iba. Ang code na ito ay valid sa loob ng 5 minuto."));
            
            repository.save(new AlertTemplate("MANUAL", 
                "SurgeAlert - Marulas BDRRMO: %s. [%s]"));
            
            System.out.println("SUCCESS: Default Alert Templates inserted into Database.");
        }
    }
}