package com.moingmoing.attendance.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.Test;

class AttendanceTest {
    @Test
    void changesParticipationTypeWithoutCreatingAnotherAttendanceRecord() {
        Attendance attendance = new Attendance(
                UUID.randomUUID(), UUID.randomUUID(), AttendanceParticipationType.NORMAL);

        attendance.changeParticipationType(AttendanceParticipationType.HOST);

        assertThat(attendance.getParticipationType()).isEqualTo(AttendanceParticipationType.HOST);
        assertThat(attendance.getAttendanceStatus()).isEqualTo(AttendanceStatus.RECORDED);
    }

    @Test
    void cancelsRecordedAttendanceWithAReason() {
        Attendance attendance = new Attendance(
                UUID.randomUUID(), UUID.randomUUID(), AttendanceParticipationType.NORMAL);

        attendance.cancel("잘못 등록했습니다.");

        assertThat(attendance.getAttendanceStatus()).isEqualTo(AttendanceStatus.CANCELLED);
        assertThat(attendance.getCancellationReason()).isEqualTo("잘못 등록했습니다.");
    }

    @Test
    void requiresAReasonWhenCancellingAttendance() {
        Attendance attendance = new Attendance(
                UUID.randomUUID(), UUID.randomUUID(), AttendanceParticipationType.COUPON);

        assertThatThrownBy(() -> attendance.cancel(" "))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
