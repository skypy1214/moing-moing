package com.moingmoing.common.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.moingmoing.common.application.WarmupControlService;

@RestController
@RequestMapping("/api/v1/admin/warmup")
class WarmupControlController {
    private final WarmupControlService warmupControlService;

    WarmupControlController(WarmupControlService warmupControlService) {
        this.warmupControlService = warmupControlService;
    }

    @GetMapping
    WarmupStatusResponse getStatus() {
        return WarmupStatusResponse.from(warmupControlService.getStatus());
    }

    @PutMapping
    WarmupStatusResponse updateStatus(@RequestBody WarmupStatusRequest request) {
        return WarmupStatusResponse.from(warmupControlService.updateStatus(request.enabled()));
    }

    private record WarmupStatusRequest(boolean enabled) {
    }

    private record WarmupStatusResponse(boolean enabled) {
        private static WarmupStatusResponse from(WarmupControlService.Status status) {
            return new WarmupStatusResponse(status.enabled());
        }
    }
}
