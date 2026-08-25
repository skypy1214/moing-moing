package com.moingmoing.auth.infrastructure;

import java.util.stream.Collectors;

import org.springframework.http.HttpMethod;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

import com.moingmoing.audit.application.ActivityLogService;
import com.moingmoing.common.api.ApiRequestLoggingFilter;

import jakarta.servlet.http.HttpServletResponse;

@Configuration
class SecurityConfiguration {
    private final ActivityLogService activityLogService;

    SecurityConfiguration(ActivityLogService activityLogService) {
        this.activityLogService = activityLogService;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    UserDetailsService userDetailsService(UserAccountRepository userAccountRepository) {
        return loginId -> userAccountRepository.findByLoginId(loginId)
                .map(account -> User.withUsername(account.getLoginId())
                        .password(account.getPasswordHash())
                        .authorities(account.getRoles().stream()
                                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                                .collect(Collectors.toSet()))
                        .disabled(account.getAccountStatus().name().equals("DISABLED"))
                        .build())
                .orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException(
                        loginId));
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http.cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(
                        (request, response, exception) -> response.sendError(HttpServletResponse.SC_UNAUTHORIZED)))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/api/v1/auth/login",
                                "/api/v1/auth/guest-login",
                                "/api/v1/health",
                                "/api/v1/ready")
                        .permitAll()
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/auth/password")
                        .hasAnyRole("ADMIN", "MEMBER", "SITE_ADMIN", "GROUP_LEADER", "STAFF")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/auth/profile")
                        .hasAnyRole("ADMIN", "MEMBER", "SITE_ADMIN", "GROUP_LEADER", "STAFF")
                        .requestMatchers(HttpMethod.GET, "/api/v1/**")
                        .hasAnyRole("ADMIN", "VIEWER", "MEMBER", "SITE_ADMIN", "GROUP_LEADER", "STAFF")
                        .anyRequest().hasRole("ADMIN"))
                .formLogin(form -> form.loginProcessingUrl("/api/v1/auth/login")
                        .successHandler((request, response, authentication) -> {
                            activityLogService.record(
                                    authentication.getName(),
                                    "LOGIN_SUCCEEDED",
                                    "auth",
                                    null,
                                    (String) request.getAttribute(ApiRequestLoggingFilter.REQUEST_ID_ATTRIBUTE),
                                    request.getMethod(),
                                    request.getRequestURI(),
                                    HttpServletResponse.SC_NO_CONTENT);
                            response.setStatus(HttpServletResponse.SC_NO_CONTENT);
                        })
                        .failureHandler((request, response, exception) -> {
                            activityLogService.record(
                                    null,
                                    "LOGIN_FAILED",
                                    "auth",
                                    null,
                                    (String) request.getAttribute(ApiRequestLoggingFilter.REQUEST_ID_ATTRIBUTE),
                                    request.getMethod(),
                                    request.getRequestURI(),
                                    HttpServletResponse.SC_UNAUTHORIZED);
                            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                        }))
                .logout(logout -> logout.logoutUrl("/api/v1/auth/logout")
                        .logoutSuccessHandler((request, response, authentication) -> {
                            activityLogService.record(
                                    authentication == null ? null : authentication.getName(),
                                    "LOGOUT_SUCCEEDED",
                                    "auth",
                                    null,
                                    (String) request.getAttribute(ApiRequestLoggingFilter.REQUEST_ID_ATTRIBUTE),
                                    request.getMethod(),
                                    request.getRequestURI(),
                                    HttpServletResponse.SC_NO_CONTENT);
                            response.setStatus(HttpServletResponse.SC_NO_CONTENT);
                        }))
                .build();
    }
}
