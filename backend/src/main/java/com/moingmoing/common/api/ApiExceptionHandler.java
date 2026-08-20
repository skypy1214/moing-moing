package com.moingmoing.common.api;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.moingmoing.attendance.application.AttendanceNotFoundException;
import com.moingmoing.attendance.application.GatheringNotFoundException;
import com.moingmoing.coupon.application.CouponNotFoundException;
import com.moingmoing.member.application.MemberNotFoundException;

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(CouponNotFoundException.class)
    ResponseEntity<Map<String, Object>> handleCouponNotFound(CouponNotFoundException exception) {
        return ResponseEntity.status(404).body(Map.of("code", "COUPON_NOT_FOUND", "message", exception.getMessage()));
    }

    @ExceptionHandler(MemberNotFoundException.class)
    ResponseEntity<Map<String, Object>> handleMemberNotFound(MemberNotFoundException exception) {
        return ResponseEntity.status(404).body(Map.of("code", "MEMBER_NOT_FOUND", "message", exception.getMessage()));
    }

    @ExceptionHandler(GatheringNotFoundException.class)
    ResponseEntity<Map<String, Object>> handleGatheringNotFound(GatheringNotFoundException exception) {
        return ResponseEntity.status(404).body(Map.of(
                "code", "GATHERING_NOT_FOUND", "message", exception.getMessage()));
    }

    @ExceptionHandler(AttendanceNotFoundException.class)
    ResponseEntity<Map<String, Object>> handleAttendanceNotFound(AttendanceNotFoundException exception) {
        return ResponseEntity.status(404).body(Map.of(
                "code", "ATTENDANCE_NOT_FOUND", "message", exception.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST", "message", exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error ->
                fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        return ResponseEntity.badRequest().body(Map.of(
                "code", "VALIDATION_FAILED",
                "message", "입력값을 확인해 주세요.",
                "fieldErrors", fieldErrors));
    }
}
