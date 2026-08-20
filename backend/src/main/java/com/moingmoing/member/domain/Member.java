package com.moingmoing.member.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "members")
public class Member {
    @Id
    private UUID id;
    private String displayName;
    private String externalNickname;
    @Enumerated(EnumType.STRING)
    private MembershipStatus membershipStatus;
    private LocalDate joinedOn;
    private LocalDate withdrawnOn;
    private String memo;
    private Instant createdAt;
    private Instant updatedAt;

    protected Member() {
    }

    public Member(String displayName, String externalNickname, LocalDate joinedOn, String memo) {
        this.id = UUID.randomUUID();
        this.displayName = displayName;
        this.externalNickname = externalNickname;
        this.joinedOn = joinedOn;
        this.memo = memo;
        this.membershipStatus = MembershipStatus.ACTIVE;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public UUID getId() {
        return id;
    }

    public MembershipStatus getMembershipStatus() {
        return membershipStatus;
    }

    public String getDisplayName() { return displayName; }
    public String getExternalNickname() { return externalNickname; }
    public LocalDate getJoinedOn() { return joinedOn; }
    public LocalDate getWithdrawnOn() { return withdrawnOn; }
    public String getMemo() { return memo; }

    public void update(String displayName, String externalNickname, LocalDate joinedOn, String memo) {
        this.displayName = displayName;
        this.externalNickname = externalNickname;
        this.joinedOn = joinedOn;
        this.memo = memo;
        updatedAt = Instant.now();
    }

    public void withdraw(LocalDate withdrawnOn) {
        if (withdrawnOn.isBefore(joinedOn)) {
            throw new IllegalArgumentException("탈퇴일은 가입일보다 이를 수 없습니다.");
        }
        membershipStatus = MembershipStatus.WITHDRAWN;
        this.withdrawnOn = withdrawnOn;
        updatedAt = Instant.now();
    }

    public void reactivate(LocalDate joinedOn) {
        membershipStatus = MembershipStatus.ACTIVE;
        this.joinedOn = joinedOn;
        withdrawnOn = null;
        updatedAt = Instant.now();
    }
}
