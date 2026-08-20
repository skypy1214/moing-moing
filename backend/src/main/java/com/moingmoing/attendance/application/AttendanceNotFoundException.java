package com.moingmoing.attendance.application;

import java.util.UUID;

public class AttendanceNotFoundException extends RuntimeException {
    public AttendanceNotFoundException(UUID id) {
        super("출석 기록을 찾을 수 없습니다: " + id);
    }
}
