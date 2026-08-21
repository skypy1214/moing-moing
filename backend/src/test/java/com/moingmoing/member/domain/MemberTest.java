package com.moingmoing.member.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class MemberTest {
    @Test
    void withdrawsMemberAndKeepsTheSameInternalIdWhenReactivated() {
        Member member = new Member("홍길동", "길동", LocalDate.of(2026, 1, 1), null, MemberRole.MEMBER);

        member.withdraw(LocalDate.of(2026, 2, 1));
        member.reactivate(LocalDate.of(2026, 3, 1));

        assertThat(member.getMembershipStatus()).isEqualTo(MembershipStatus.ACTIVE);
        assertThat(member.getJoinedOn()).isEqualTo(LocalDate.of(2026, 3, 1));
        assertThat(member.getWithdrawnOn()).isNull();
    }

    @Test
    void rejectsWithdrawalBeforeJoiningDate() {
        Member member = new Member("홍길동", null, LocalDate.of(2026, 2, 1), null, MemberRole.MEMBER);

        assertThatThrownBy(() -> member.withdraw(LocalDate.of(2026, 1, 31)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void changesTheMemberRoleWithoutChangingMembershipStatus() {
        Member member = new Member("홍길동", null, LocalDate.of(2026, 1, 1), null);

        member.update("홍길동", null, LocalDate.of(2026, 1, 1), null, MemberRole.LEADER);

        assertThat(member.getMemberRole()).isEqualTo(MemberRole.LEADER);
        assertThat(member.getMembershipStatus()).isEqualTo(MembershipStatus.ACTIVE);
    }
}
