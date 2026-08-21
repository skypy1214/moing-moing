package com.moingmoing.member.application;

import java.time.LocalDate;

import com.moingmoing.member.domain.Member;

public record MemberAttendanceSummary(Member member, LocalDate lastAttendanceOn) {
}
