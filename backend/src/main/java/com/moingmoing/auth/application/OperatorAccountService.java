package com.moingmoing.auth.application;

import java.security.SecureRandom;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.auth.domain.AccountStatus;
import com.moingmoing.auth.domain.RoleCode;
import com.moingmoing.auth.domain.UserAccount;
import com.moingmoing.auth.infrastructure.UserAccountRepository;

@Service
public class OperatorAccountService {
    private static final char[] RESET_PASSWORD_CHARACTERS =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789".toCharArray();
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;

    public OperatorAccountService(UserAccountRepository userAccountRepository, PasswordEncoder passwordEncoder) {
        this.userAccountRepository = userAccountRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<AccountSummary> findAll() {
        return userAccountRepository.findAll().stream()
                .map(account -> new AccountSummary(
                        account.getId(),
                        account.getLoginId(),
                        account.getDisplayName(),
                        account.getPrimaryRole(),
                        account.getAccountStatus()))
                .toList();
    }

    @Transactional
    public UserAccount create(String loginId, String displayName, String password, RoleCode role) {
        if (userAccountRepository.findByLoginId(loginId).isPresent()) {
            throw new IllegalArgumentException("이미 사용 중인 로그인 ID입니다.");
        }
        UserAccount account = new UserAccount(
                loginId, displayName, passwordEncoder.encode(password), Set.of(role));
        return userAccountRepository.save(account);
    }

    @Transactional
    public void disable(UUID accountId) {
        UserAccount account = userAccountRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("운영 계정을 찾을 수 없습니다."));
        if (account.isActive() && userAccountRepository.countByAccountStatus(AccountStatus.ACTIVE) == 1) {
            throw new IllegalArgumentException("마지막 활성 운영 계정은 비활성화할 수 없습니다.");
        }
        account.disable();
    }

    @Transactional
    public void activate(UUID accountId) {
        UserAccount account = userAccountRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("운영 계정을 찾을 수 없습니다."));
        account.activate();
    }

    @Transactional
    public void update(UUID accountId, String loginId, String displayName, RoleCode role) {
        UserAccount account = userAccountRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("운영 계정을 찾을 수 없습니다."));
        userAccountRepository.findByLoginId(loginId)
                .filter(found -> !found.getId().equals(accountId))
                .ifPresent(found -> { throw new IllegalArgumentException("이미 사용 중인 로그인 ID입니다."); });
        account.updateProfile(loginId, displayName, role);
    }

    @Transactional
    public void changeOwnPassword(String loginId, String password) {
        UserAccount account = userAccountRepository.findByLoginId(loginId)
                .orElseThrow(() -> new IllegalArgumentException("운영 계정을 찾을 수 없습니다."));
        account.resetPassword(passwordEncoder.encode(password));
    }

    @Transactional(readOnly = true)
    public AccountProfile findProfile(String loginId) {
        UserAccount account = userAccountRepository.findByLoginId(loginId)
                .orElseThrow(() -> new IllegalArgumentException("운영 계정을 찾을 수 없습니다."));
        return new AccountProfile(account.getLoginId(), account.getDisplayName(), account.getPrimaryRole());
    }

    @Transactional
    public void updateOwnProfile(String loginId, String displayName, String password) {
        UserAccount account = userAccountRepository.findByLoginId(loginId)
                .orElseThrow(() -> new IllegalArgumentException("운영 계정을 찾을 수 없습니다."));
        account.updateDisplayName(displayName);
        if (password != null && !password.isBlank()) {
            account.resetPassword(passwordEncoder.encode(password));
        }
    }

    @Transactional
    public ResetPasswordResult resetPassword(UUID accountId) {
        UserAccount account = userAccountRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("운영 계정을 찾을 수 없습니다."));
        String temporaryPassword = generateResetPassword();
        account.resetPassword(passwordEncoder.encode(temporaryPassword));
        return new ResetPasswordResult(temporaryPassword);
    }

    private String generateResetPassword() {
        StringBuilder password = new StringBuilder(16);
        for (int index = 0; index < 16; index += 1) {
            password.append(RESET_PASSWORD_CHARACTERS[SECURE_RANDOM.nextInt(RESET_PASSWORD_CHARACTERS.length)]);
        }
        return password.toString();
    }

    public record AccountSummary(
            UUID id,
            String loginId,
            String displayName,
            RoleCode role,
            AccountStatus status) {
    }

    public record AccountProfile(String loginId, String displayName, RoleCode role) {
    }

    public record ResetPasswordResult(String temporaryPassword) {
    }
}
