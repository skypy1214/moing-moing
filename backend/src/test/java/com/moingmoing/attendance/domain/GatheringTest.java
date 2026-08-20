package com.moingmoing.attendance.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class GatheringTest {
    @Test
    void opensAndClosesAGathering() {
        Gathering gathering = new Gathering(LocalDate.of(2026, 8, 20), null, null, null);

        gathering.open();
        gathering.close();

        assertThat(gathering.getGatheringStatus()).isEqualTo(GatheringStatus.CLOSED);
    }

    @Test
    void rejectsClosingADraftGathering() {
        Gathering gathering = new Gathering(LocalDate.of(2026, 8, 20), null, null, null);

        assertThatThrownBy(gathering::close)
                .isInstanceOf(IllegalArgumentException.class);
    }
}
