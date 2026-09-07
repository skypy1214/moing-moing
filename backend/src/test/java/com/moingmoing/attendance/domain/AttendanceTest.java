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

    @Test
    void storesAnAppliedFeeAndMarksTheAttendanceAsPending() {
        Attendance attendance = new Attendance(
                UUID.randomUUID(), UUID.randomUUID(), AttendanceParticipationType.NORMAL, 10000);

        assertThat(attendance.getAppliedFee()).isEqualTo(10000);
        assertThat(attendance.getPaymentStatus()).isEqualTo(AttendancePaymentStatus.PENDING);

        attendance.updatePayment(5000, AttendancePaymentStatus.PAID);

        assertThat(attendance.getAppliedFee()).isEqualTo(5000);
        assertThat(attendance.getPaymentStatus()).isEqualTo(AttendancePaymentStatus.PAID);
        assertThat(attendance.getPaidAt()).isNotNull();
    }

    @Test
    void requiresZeroFeeForAnExemptAttendance() {
        Attendance attendance = new Attendance(
                UUID.randomUUID(), UUID.randomUUID(), AttendanceParticipationType.NORMAL, 10000);

        assertThatThrownBy(() -> attendance.updatePayment(10000, AttendancePaymentStatus.EXEMPT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void allowsAnUnconfirmedLegacyFeeToRemainPendingAtZeroWon() {
        Attendance attendance = new Attendance(
                UUID.randomUUID(), UUID.randomUUID(), AttendanceParticipationType.NORMAL, 0);

        attendance.updatePayment(0, AttendancePaymentStatus.PENDING);

        assertThat(attendance.getPaymentStatus()).isEqualTo(AttendancePaymentStatus.PENDING);
    }

    @Test
    void createsAHostAttendanceAsFeeExempt() {
        Attendance attendance = new Attendance(
                UUID.randomUUID(), UUID.randomUUID(), AttendanceParticipationType.HOST, 0);

        assertThat(attendance.getPaymentStatus()).isEqualTo(AttendancePaymentStatus.EXEMPT);
        assertThat(attendance.getAppliedFee()).isZero();
    }

    @Test
    void keepsAnIndividuallyAdjustedFeeWhenTheGatheringDefaultChanges() {
        Attendance attendance = new Attendance(
                UUID.randomUUID(), UUID.randomUUID(), AttendanceParticipationType.NORMAL, 10000);

        attendance.updatePayment(5000, AttendancePaymentStatus.PENDING);
        attendance.applyDefaultParticipationFee(20000);

        assertThat(attendance.getAppliedFee()).isEqualTo(5000);
        assertThat(attendance.isFeeOverridden()).isTrue();
    }

    @Test
    void appliesTheRoleExemptionWithoutOverwritingAnIndividualAdjustment() {
        Attendance attendance = new Attendance(
                UUID.randomUUID(), UUID.randomUUID(), AttendanceParticipationType.NORMAL, 10000);

        attendance.applyRoleFeeExemption();

        assertThat(attendance.getAppliedFee()).isZero();
        assertThat(attendance.getPaymentStatus()).isEqualTo(AttendancePaymentStatus.EXEMPT);

        attendance.updatePayment(5000, AttendancePaymentStatus.PENDING);
        attendance.applyRoleFeeExemption();

        assertThat(attendance.getAppliedFee()).isEqualTo(5000);
        assertThat(attendance.getPaymentStatus()).isEqualTo(AttendancePaymentStatus.PENDING);
    }
}
