package com.moingmoing.auth.api;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import com.moingmoing.auth.application.OperatorAccountService;

@RestController
@RequestMapping("/api/v1/auth")
class AuthController {
    private final OperatorAccountService operatorAccountService;

    AuthController(OperatorAccountService operatorAccountService) {
        this.operatorAccountService = operatorAccountService;
    }

    @GetMapping("/me")
    ResponseEntity<Map<String, Object>> me(Authentication authentication) {
        OperatorAccountService.AccountProfile account = operatorAccountService.findProfile(authentication.getName());
        boolean isAdmin = account.role().name().equals("ADMIN");
        return ResponseEntity.ok(Map.of(
                "loginId", account.loginId(),
                "displayName", account.displayName(),
                "isAdmin", isAdmin));
    }

    @PatchMapping("/password")
    ResponseEntity<Void> changeOwnPassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request) {
        operatorAccountService.changeOwnPassword(authentication.getName(), request.password());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/profile")
    ResponseEntity<Void> updateOwnProfile(
            Authentication authentication,
            @Valid @RequestBody UpdateOwnProfileRequest request) {
        operatorAccountService.updateOwnProfile(authentication.getName(), request.displayName(), request.password());
        return ResponseEntity.noContent().build();
    }

    private record ChangePasswordRequest(@NotBlank @Size(min = 8, max = 100) String password) {
    }

    private record UpdateOwnProfileRequest(
            @NotBlank @Size(max = 100) String displayName,
            @Size(min = 8, max = 100) String password) {
    }
}
