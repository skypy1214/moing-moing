package com.moingmoing.member.api;

import java.time.LocalDate;
import java.util.UUID;

import com.moingmoing.member.domain.Member;
import com.moingmoing.member.domain.MemberRole;
import com.moingmoing.member.domain.MembershipStatus;

record MemberResponse(
        UUID id,
        String displayName,
        String externalNickname,
        MembershipStatus membershipStatus,
        MemberRole memberRole,
        LocalDate joinedOn,
        LocalDate withdrawnOn,
        String memo,
        LocalDate lastAttendanceOn) {
    static MemberResponse from(Member member) {
        return from(member, null);
    }

    static MemberResponse from(Member member, LocalDate lastAttendanceOn) {
        return new MemberResponse(
                member.getId(),
                member.getDisplayName(),
                member.getExternalNickname(),
                member.getMembershipStatus(),
                member.getMemberRole(),
                member.getJoinedOn(),
                member.getWithdrawnOn(),
                member.getMemo(),
                lastAttendanceOn);
    }
}
