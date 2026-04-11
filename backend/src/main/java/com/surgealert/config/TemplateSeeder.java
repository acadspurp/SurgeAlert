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
                "SurgeAlert [{status}]: BABALA. Bantayan ang opisyal na anunsyo. Antas: {level}. {timestamp} - Marulas BDRRMO"));
            
            repository.save(new AlertTemplate("ORANGE", 
                "SurgeAlert [{status}]: MAGHANDA SA PAGLIKAS. Ihanda ang go-bag at mga dokumento. Antas: {level}. {timestamp} - Marulas BDRRMO"));
            
            repository.save(new AlertTemplate("RED", 
                "SurgeAlert [{status}]: LUMIKAS AGAD. Pumunta sa pinakamalapit na evacuation center. Antas: {level}. {timestamp} - Marulas BDRRMO"));
            
            repository.save(new AlertTemplate("GREEN", 
                "SurgeAlert [{status}]: ALL-CLEAR. Ligtas na. Antas: {level}. {timestamp} - Marulas BDRRMO"));
            
            repository.save(new AlertTemplate("OTP", 
                "Ang iyong SurgeAlert OTP ay: {otp}. Huwag itong ibahagi sa iba. Ang code na ito ay valid sa loob ng 5 minuto."));
            
            repository.save(new AlertTemplate("MANUAL", 
                "SurgeAlert [MANUAL]: {message} {timestamp} - Marulas BDRRMO"));
            
            System.out.println("SUCCESS: Default Alert Templates inserted into Database.");
        }
    }
}