package com.surgealert.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;

@Service
public class MlTrainingService {

    private static final Logger log = LoggerFactory.getLogger(MlTrainingService.class);

    private final MlModelRegistryService registry;

    @Value("${surgealert.ml.edge-system-dir:EdgeSystem}")
    private String edgeSystemDir;

    @Value("${surgealert.ml.retrain-days:90}")
    private int retrainDays;

    @Value("${surgealert.ml.retrain-min-rows:80}")
    private int retrainMinRows;

    public MlTrainingService(MlModelRegistryService registry) {
        this.registry = registry;
    }

    public boolean runScheduledRetrain() {
        Path outputDir = registry.getModelDirectory();
        Path script = resolveRetrainScript();
        if (script == null || !script.toFile().exists()) {
            log.error("Retrain script not found under {}", edgeSystemDir);
            return false;
        }

        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "python",
                    script.toString(),
                    "--output-dir", outputDir.toString(),
                    "--days", String.valueOf(retrainDays),
                    "--min-rows", String.valueOf(retrainMinRows)
            );
            pb.directory(resolveEdgeRoot().toFile());
            pb.redirectErrorStream(true);
            pb.environment().putAll(System.getenv());

            Process process = pb.start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.info("[ML-Retrain] {}", line);
                }
            }

            boolean finished = process.waitFor(45, TimeUnit.MINUTES);
            if (!finished) {
                process.destroyForcibly();
                log.error("ML retrain timed out");
                return false;
            }
            if (process.exitValue() != 0) {
                log.error("ML retrain failed with exit code {}", process.exitValue());
                return false;
            }
            log.info("ML retrain complete. Version={}", registry.getCurrentVersion());
            return registry.modelArtifactExists();
        } catch (Exception e) {
            log.error("ML retrain error: {}", e.getMessage());
            return false;
        }
    }

    private Path resolveEdgeRoot() {
        Path cwd = Paths.get("").toAbsolutePath();
        Path candidate = cwd.resolve(edgeSystemDir);
        if (candidate.resolve("ml_model").toFile().exists()) {
            return candidate;
        }
        return cwd.getParent() != null ? cwd.getParent().resolve(edgeSystemDir) : candidate;
    }

    private Path resolveRetrainScript() {
        return resolveEdgeRoot().resolve("ml_model").resolve("retrain_from_postgres.py");
    }
}
