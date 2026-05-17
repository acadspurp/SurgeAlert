package com.surgealert.scheduler;

import com.surgealert.service.MlTrainingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class MlTrainingScheduler {

    private static final Logger log = LoggerFactory.getLogger(MlTrainingScheduler.class);

    private final MlTrainingService trainingService;

    @Value("${surgealert.ml.retrain-enabled:true}")
    private boolean retrainEnabled;

    public MlTrainingScheduler(MlTrainingService trainingService) {
        this.trainingService = trainingService;
    }

    /** Weekly Sunday 04:00 Asia/Manila — server retrains from Postgres, Pi pulls new artifact. */
    @Scheduled(cron = "${surgealert.ml.retrain-cron:0 0 4 * * SUN}", zone = "Asia/Manila")
    public void retrainWeekly() {
        if (!retrainEnabled) {
            return;
        }
        log.info("Starting scheduled ML retrain...");
        boolean ok = trainingService.runScheduledRetrain();
        log.info("Scheduled ML retrain finished: success={}", ok);
    }
}
