package com.moingmoing.common.application;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class WarmupControlService {
    private final HttpClient httpClient;
    private final String workerUrl;
    private final String controlToken;

    public WarmupControlService(
            @Value("${app.warmup-control.worker-url:}") String workerUrl,
            @Value("${app.warmup-control.token:}") String controlToken) {
        this.httpClient = HttpClient.newHttpClient();
        this.workerUrl = workerUrl;
        this.controlToken = controlToken;
    }

    public Status getStatus() {
        return sendRequest("GET", null);
    }

    public Status updateStatus(boolean enabled) {
        return sendRequest("PUT", "{\"enabled\":" + enabled + "}");
    }

    private Status sendRequest(String method, String body) {
        if (workerUrl.isBlank() || controlToken.isBlank()) {
            throw new IllegalStateException("서버 깨우기 제어가 아직 설정되지 않았습니다.");
        }

        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(workerUrl))
                .header("X-Warmup-Control-Token", controlToken)
                .header("Accept", "application/json");
        if (body == null) {
            request.GET();
        } else {
            request.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(body));
        }

        try {
            HttpResponse<String> response = httpClient.send(
                    request.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("서버 깨우기 상태를 Cloudflare에서 확인하지 못했습니다.");
            }
            return parseStatus(response.body());
        } catch (IOException exception) {
            throw new IllegalStateException("서버 깨우기 상태를 Cloudflare에서 확인하지 못했습니다.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("서버 깨우기 상태 확인이 중단되었습니다.", exception);
        }
    }

    private Status parseStatus(String body) {
        if (body.contains("\"enabled\":true")) {
            return new Status(true);
        }
        if (body.contains("\"enabled\":false")) {
            return new Status(false);
        }
        throw new IllegalStateException("Cloudflare의 서버 깨우기 상태 응답이 올바르지 않습니다.");
    }

    public record Status(boolean enabled) {
    }
}
