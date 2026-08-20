package com.moingmoing.coupon.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class AttendanceChampionAwardTest {
    @Test
    void preserves_a_cancelled_award_instead_of_deleting_it() {
        AttendanceChampionAward award = new AttendanceChampionAward(
                LocalDate.of(2026, 9, 1), UUID.randomUUID(), 4, "champion-reward-v1", 2);

        award.cancel();

        assertEquals(AttendanceChampionAwardStatus.CANCELLED, award.getAwardStatus());
        assertThrows(IllegalArgumentException.class, award::cancel);
    }
}
