package com.moingmoing.auth.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.auth.domain.UserAccount;
import com.moingmoing.auth.infrastructure.UserAccountRepository;

@Service
public class LoginAttemptService {
    private final UserAccountRepository userAccountRepository;

    public LoginAttemptService(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    @Transactional
    public void recordFailure(String loginId) {
        if (loginId == null || loginId.isBlank()) {
            return;
        }
        userAccountRepository.findByLoginId(loginId).ifPresent(UserAccount::recordFailedLogin);
    }

    @Transactional
    public void recordSuccess(String loginId) {
        userAccountRepository.findByLoginId(loginId).ifPresent(UserAccount::resetFailedLoginCount);
    }
}
