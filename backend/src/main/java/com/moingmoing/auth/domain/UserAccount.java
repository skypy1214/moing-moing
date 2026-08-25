package com.moingmoing.auth.domain;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_accounts")
public class UserAccount {
    @Id
    private UUID id;
    private String loginId;
    private String displayName;
    private String passwordHash;
    @Enumerated(EnumType.STRING)
    private AccountStatus accountStatus;
    @ElementCollection(targetClass = RoleCode.class)
    @CollectionTable(name = "user_account_roles", joinColumns = @JoinColumn(name = "user_account_id"))
    @Column(name = "role_code")
    @Enumerated(EnumType.STRING)
    private Set<RoleCode> roles = new HashSet<>();
    private Instant lastLoginAt;
    private Instant createdAt;
    private Instant updatedAt;

    protected UserAccount() {
    }

    public UserAccount(String loginId, String displayName, String passwordHash, Set<RoleCode> roles) {
        this.id = UUID.randomUUID();
        this.loginId = loginId;
        this.displayName = displayName;
        this.passwordHash = passwordHash;
        this.roles = new HashSet<>(roles);
        this.accountStatus = AccountStatus.ACTIVE;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public UUID getId() {
        return id;
    }

    public String getLoginId() {
        return loginId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public AccountStatus getAccountStatus() {
        return accountStatus;
    }

    public boolean isActive() {
        return accountStatus == AccountStatus.ACTIVE;
    }

    public Set<RoleCode> getRoles() {
        return Set.copyOf(roles);
    }

    public RoleCode getPrimaryRole() {
        return roles.stream().findFirst().orElse(RoleCode.MEMBER);
    }

    public void updateProfile(String loginId, String displayName, RoleCode role) {
        this.loginId = loginId;
        this.displayName = displayName;
        this.roles = Set.of(role);
        updatedAt = Instant.now();
    }

    public void updateDisplayName(String displayName) {
        this.displayName = displayName;
        updatedAt = Instant.now();
    }

    public void disable() {
        accountStatus = AccountStatus.DISABLED;
        updatedAt = Instant.now();
    }

    public void activate() {
        accountStatus = AccountStatus.ACTIVE;
        updatedAt = Instant.now();
    }

    public void resetPassword(String passwordHash) {
        this.passwordHash = passwordHash;
        updatedAt = Instant.now();
    }
}
