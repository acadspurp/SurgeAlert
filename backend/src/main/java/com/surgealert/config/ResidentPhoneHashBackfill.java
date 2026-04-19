package com.surgealert.config;

import com.surgealert.service.ResidentService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(2000)
public class ResidentPhoneHashBackfill implements ApplicationRunner {

    private final ResidentService residentService;

    public ResidentPhoneHashBackfill(ResidentService residentService) {
        this.residentService = residentService;
    }

    @Override
    public void run(ApplicationArguments args) {
        residentService.backfillPhoneSearchHashes();
    }
}
