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
                "SurgeAlert YELLOW: Rising water Tullahan. Be ready. {timestamp} - Marulas BDRRMO"));
            
            repository.save(new AlertTemplate("ORANGE", 
                "SurgeAlert ORANGE: Prepare to evacuate Tullahan. {timestamp} - Marulas BDRRMO"));
            
            repository.save(new AlertTemplate("RED", 
                "SurgeAlert RED: EVACUATE NOW Tullahan. Go to nearest center. {timestamp} - Marulas BDRRMO"));
            
            repository.save(new AlertTemplate("GREEN", 
                "SurgeAlert ALL-CLEAR: Water normal Tullahan. {timestamp} - Marulas BDRRMO"));
            
            repository.save(new AlertTemplate("OTP", 
                "Ang iyong SurgeAlert OTP ay: {code}. Huwag itong ibahagi sa iba. Ang code na ito ay valid sa loob ng 10 minuto."));
            
            repository.save(new AlertTemplate("REGISTER", 
                "SurgeAlert: Welcome! Matagumpay ang iyong pag-subscribe sa Marulas Flood Alert System. Makakatanggap ka na ng mga SMS alerts kung may banta ng baha."));
            
            repository.save(new AlertTemplate("MANUAL", 
                "SurgeAlert - Marulas BDRRMO: %s. [%s]"));
            
            System.out.println("SUCCESS: Default Alert Templates inserted into Database.");
        }

        repository.findByAlertType("CRITICAL").ifPresent(repository::delete);

        repository.findByAlertType("OTP").ifPresent(t -> {
            String text = t.getTemplate();
            if (text != null && text.contains("5 minuto")) {
                t.setTemplate(
                        "Ang iyong SurgeAlert OTP ay: {code}. Huwag itong ibahagi sa iba. Ang code na ito ay valid sa loob ng 10 minuto.");
                repository.save(t);
                System.out.println("SUCCESS: OTP template validity updated to 10 minutes.");
            }
        });

        // Migrate legacy [%s] timestamp placeholders (String.format caused garbled SMS).
        for (String alertType : new String[] { "YELLOW", "ORANGE", "RED", "GREEN" }) {
            repository.findByAlertType(alertType).ifPresent(t -> {
                String text = t.getTemplate();
                if (text != null && text.contains("[%s]")) {
                    t.setTemplate(text.replace("[%s]", "{timestamp}"));
                    repository.save(t);
                    System.out.println("SUCCESS: Migrated " + alertType + " template [%s] -> {timestamp}.");
                }
            });
        }
    }
}