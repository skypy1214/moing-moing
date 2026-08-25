package com.moingmoing.auth.infrastructure;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.auth.domain.UserAccount;
import com.moingmoing.auth.domain.AccountStatus;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {
    @EntityGraph(attributePaths = "roles")
    Optional<UserAccount> findByLoginId(String loginId);

    long countByAccountStatus(AccountStatus accountStatus);
}
