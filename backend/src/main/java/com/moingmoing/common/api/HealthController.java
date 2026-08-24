package com.moingmoing.common.api;

import java.sql.SQLException;
import java.util.Map;

import javax.sql.DataSource;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/api/v1/health")
    Map<String, String> health() {
        return Map.of("status", "UP");
    }

    @GetMapping("/api/v1/ready")
    ResponseEntity<Map<String, String>> ready() {
        try (var connection = dataSource.getConnection()) {
            if (!connection.isValid(2)) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(Map.of("status", "STARTING"));
            }
            return ResponseEntity.ok(Map.of("status", "UP"));
        } catch (SQLException exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "STARTING"));
        }
    }
}
