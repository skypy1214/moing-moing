package com.moingmoing.auth.api;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import com.moingmoing.auth.application.OperatorAccountService;

@RestController
@RequestMapping("/api/v1/auth")
class AuthController {
    private static final String GUEST_LOGIN_ID = "guest";
    private static final SecurityContextRepository SECURITY_CONTEXT_REPOSITORY =
            new HttpSessionSecurityContextRepository();
    private final OperatorAccountService operatorAccountService;

    AuthController(OperatorAccountService operatorAccountService) {
        this.operatorAccountService = operatorAccountService;
    }

    @GetMapping("/me")
    ResponseEntity<Map<String, Object>> me(Authentication authentication) {
        if (GUEST_LOGIN_ID.equals(authentication.getName())) {
            return ResponseEntity.ok(Map.of(
                    "loginId", GUEST_LOGIN_ID,
                    "displayName", "게스트",
                    "readOnly", true));
        }
        OperatorAccountService.AccountProfile account = operatorAccountService.findProfile(authentication.getName());
        boolean isAdmin = account.role().name().equals("ADMIN");
        boolean readOnly = !isAdmin;
        return ResponseEntity.ok(Map.of(
                "loginId", account.loginId(),
                "displayName", account.displayName(),
                "readOnly", readOnly));
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

    @PostMapping("/guest-login")
    ResponseEntity<Void> loginAsGuest(HttpServletRequest request, HttpServletResponse response) {
        Authentication guestAuthentication = new UsernamePasswordAuthenticationToken(
                GUEST_LOGIN_ID,
                null,
                java.util.List.of(new SimpleGrantedAuthority("ROLE_VIEWER")));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(guestAuthentication);
        SecurityContextHolder.setContext(context);
        SECURITY_CONTEXT_REPOSITORY.saveContext(context, request, response);
        return ResponseEntity.noContent().build();
    }

    private record ChangePasswordRequest(@NotBlank @Size(min = 8, max = 100) String password) {
    }

    private record UpdateOwnProfileRequest(
            @NotBlank @Size(max = 100) String displayName,
            @Size(min = 8, max = 100) String password) {
    }
}
