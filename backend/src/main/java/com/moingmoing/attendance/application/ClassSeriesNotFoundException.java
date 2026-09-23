package com.moingmoing.attendance.application;

import java.util.UUID;

public class ClassSeriesNotFoundException extends RuntimeException {
    public ClassSeriesNotFoundException(UUID id) {
        super("연속 수업을 찾을 수 없습니다: " + id);
    }
}
