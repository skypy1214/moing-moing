package com.moingmoing.common.api;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.servlet.http.HttpServletRequest;

import com.moingmoing.attendance.application.AttendanceNotFoundException;
import com.moingmoing.attendance.application.GatheringNotFoundException;
import com.moingmoing.coupon.application.CouponNotFoundException;
import com.moingmoing.member.application.MemberNotFoundException;

@RestControllerAdvice
class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

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

    @ExceptionHandler(RuntimeException.class)
    ResponseEntity<Map<String, String>> handleUnexpected(
            RuntimeException exception,
            HttpServletRequest request) {
        String requestId = String.valueOf(request.getAttribute(ApiRequestLoggingFilter.REQUEST_ID_ATTRIBUTE));
        log.error("api-exception requestId={} method={} path={}",
                requestId,
                request.getMethod(),
                request.getRequestURI(),
                exception);
        return ResponseEntity.internalServerError().body(Map.of(
                "code", "INTERNAL_ERROR",
                "message", "서버 오류가 발생했습니다. 요청 ID를 운영진에게 알려 주세요.",
                "requestId", requestId));
    }
}
