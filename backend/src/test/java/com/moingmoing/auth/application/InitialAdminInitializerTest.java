package com.moingmoing.auth.application;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.moingmoing.auth.infrastructure.UserAccountRepository;

class InitialAdminInitializerTest {
    private final InitialAdminInitializer initializer = new InitialAdminInitializer();
    private final UserAccountRepository userAccountRepository = mock(UserAccountRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final ApplicationArguments arguments = new DefaultApplicationArguments();

    @Test
    void skipsDatabaseLookupWhenInitialAdminCredentialsAreNotConfigured() throws Exception {
        ApplicationRunner runner = initializer.createInitialAdmin(
                userAccountRepository, passwordEncoder, "", "");

        runner.run(arguments);

        verifyNoInteractions(userAccountRepository, passwordEncoder);
    }

    @Test
    void createsInitialAdminWhenCredentialsAreConfiguredAndNoAccountExists() throws Exception {
        when(userAccountRepository.count()).thenReturn(0L);
        when(passwordEncoder.encode("password")).thenReturn("encoded-password");
        ApplicationRunner runner = initializer.createInitialAdmin(
                userAccountRepository, passwordEncoder, "admin", "password");

        runner.run(arguments);

        verify(userAccountRepository).count();
        verify(passwordEncoder).encode("password");
        verify(userAccountRepository).save(any());
    }

    @Test
    void doesNotCreateInitialAdminWhenAnAccountAlreadyExists() throws Exception {
        when(userAccountRepository.count()).thenReturn(1L);
        ApplicationRunner runner = initializer.createInitialAdmin(
                userAccountRepository, passwordEncoder, "admin", "password");

        runner.run(arguments);

        verify(userAccountRepository).count();
        verify(passwordEncoder, never()).encode("password");
        verify(userAccountRepository, never()).save(any());
    }
}
