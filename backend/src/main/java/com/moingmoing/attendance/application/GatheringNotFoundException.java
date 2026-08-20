package com.moingmoing.attendance.application;

import java.util.UUID;

public class GatheringNotFoundException extends RuntimeException {
    public GatheringNotFoundException(UUID id) {
        super("모임을 찾을 수 없습니다: " + id);
    }
}
