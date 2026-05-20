package com.surgealert.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SensorDataDtoMqttMappingTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void mapsEdgeMqttSnakeCaseAlertFields() throws Exception {
        String json = """
                {
                  "water_level": 4.2,
                  "current_alert_level": "ORANGE",
                  "predicted_level": 4.8,
                  "predicted_alert_level": "RED",
                  "rise_rate": 0.12
                }
                """;

        SensorDataDTO dto = mapper.readValue(json, SensorDataDTO.class);

        assertEquals(4.2, dto.getWaterLevelM());
        assertEquals("ORANGE", dto.getCurrentAlertLevel());
        assertEquals(4.8, dto.getPredictedLevel());
        assertEquals("RED", dto.getPredictedAlertLevel());
        assertEquals(0.12, dto.getRiseRate());
    }
}
