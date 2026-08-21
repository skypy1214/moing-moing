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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/v1/auth")
class AuthController {
    private static final String GUEST_LOGIN_ID = "guest";
    private static final SecurityContextRepository SECURITY_CONTEXT_REPOSITORY =
            new HttpSessionSecurityContextRepository();

    @GetMapping("/me")
    ResponseEntity<Map<String, Object>> me(Authentication authentication) {
        boolean readOnly = authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_VIEWER"));
        return ResponseEntity.ok(Map.of("loginId", authentication.getName(), "readOnly", readOnly));
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
}
