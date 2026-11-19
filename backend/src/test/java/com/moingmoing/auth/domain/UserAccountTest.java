package com.moingmoing.auth.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.Test;

class UserAccountTest {
    @Test
    void disablesAccountAfterTenFailedLoginsAndResetsCountWhenReactivated() {
        UserAccount account = new UserAccount(
                "operator", "운영진", "encoded-password", Set.of(RoleCode.STAFF));

        for (int index = 0; index < 10; index += 1) {
            account.recordFailedLogin();
        }

        assertThat(account.isActive()).isFalse();

        account.activate();

        for (int index = 0; index < 9; index += 1) {
            account.recordFailedLogin();
        }

        assertThat(account.isActive()).isTrue();
    }
}
