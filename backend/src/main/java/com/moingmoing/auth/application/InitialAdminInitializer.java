package com.moingmoing.auth.application;

import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.moingmoing.auth.domain.RoleCode;
import com.moingmoing.auth.domain.UserAccount;
import com.moingmoing.auth.infrastructure.UserAccountRepository;

@Configuration
class InitialAdminInitializer {
    @Bean
    ApplicationRunner createInitialAdmin(
            UserAccountRepository userAccountRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.initial-admin.login:}") String login,
            @Value("${app.initial-admin.password:}") String password) {
        return arguments -> {
            if (login.isBlank() || password.isBlank()) {
                return;
            }
            if (userAccountRepository.count() == 0) {
                UserAccount account = new UserAccount(
                        login, login, passwordEncoder.encode(password), Set.of(RoleCode.ADMIN));
                userAccountRepository.save(account);
            }
        };
    }
}
