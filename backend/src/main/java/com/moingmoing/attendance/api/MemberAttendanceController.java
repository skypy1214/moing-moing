package com.moingmoing.attendance.api;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.moingmoing.attendance.application.AttendanceService;

@RestController
@RequestMapping("/api/v1/members/{memberId}/attendance-history")
class MemberAttendanceController {
    private final AttendanceService attendanceService;

    MemberAttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    @GetMapping
    List<AttendanceResponse> findAttendanceHistory(@PathVariable UUID memberId) {
        return attendanceService.findMemberAttendanceHistory(memberId).stream()
                .map(AttendanceResponse::from)
                .toList();
    }
}
