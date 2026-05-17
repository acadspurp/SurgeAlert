package com.surgealert.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class MlModelRegistryService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${surgealert.ml.model-dir:data/models}")
    private String modelDir;

    public Path getModelDirectory() {
        return Paths.get(modelDir).toAbsolutePath().normalize();
    }

    public Path getModelFilePath() {
        return getModelDirectory().resolve("flood_prediction_model.joblib");
    }

    public Path getVersionFilePath() {
        return getModelDirectory().resolve("model_version.json");
    }

    public String getCurrentVersion() {
        try {
            Path versionFile = getVersionFilePath();
            if (!Files.exists(versionFile)) {
                return "0";
            }
            JsonNode root = objectMapper.readTree(versionFile.toFile());
            JsonNode version = root.get("version");
            return version != null ? version.asText("0") : "0";
        } catch (IOException e) {
            return "0";
        }
    }

    public boolean modelArtifactExists() {
        try {
            return Files.exists(getModelFilePath()) && Files.size(getModelFilePath()) > 0;
        } catch (IOException e) {
            return false;
        }
    }
}
