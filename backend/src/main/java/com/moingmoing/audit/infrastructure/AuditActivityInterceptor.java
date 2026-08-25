package com.moingmoing.audit.infrastructure;

import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.moingmoing.audit.application.ActivityLogService;
import com.moingmoing.common.api.ApiRequestLoggingFilter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
class AuditActivityInterceptor implements HandlerInterceptor {
    private final ActivityLogService activityLogService;

    AuditActivityInterceptor(ActivityLogService activityLogService) {
        this.activityLogService = activityLogService;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception exception) {
        if (HttpMethod.GET.matches(request.getMethod())
                || response.getStatus() == HttpServletResponse.SC_UNAUTHORIZED) {
            return;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String loginId = authentication == null || !authentication.isAuthenticated()
                ? null : authentication.getName();
        String[] segments = request.getRequestURI().split("/");
        String targetType = segments.length > 3 ? segments[3] : null;
        String targetId = segments.length > 4 ? segments[4] : null;
        String action = request.getMethod() + "_" + (targetType == null ? "API" : targetType.toUpperCase())
                + (response.getStatus() < 400 ? "_SUCCEEDED" : "_FAILED");
        activityLogService.record(
                loginId,
                action,
                targetType,
                targetId,
                (String) request.getAttribute(ApiRequestLoggingFilter.REQUEST_ID_ATTRIBUTE),
                request.getMethod(),
                request.getRequestURI(),
                response.getStatus());
    }
}
