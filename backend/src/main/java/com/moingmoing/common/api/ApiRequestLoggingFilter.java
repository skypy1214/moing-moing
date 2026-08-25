package com.moingmoing.common.api;

import java.io.IOException;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiRequestLoggingFilter extends OncePerRequestFilter {
    public static final String REQUEST_ID_ATTRIBUTE = "requestId";
    public static final String REQUEST_ID_HEADER = "X-Request-Id";

    private static final Logger log = LoggerFactory.getLogger(ApiRequestLoggingFilter.class);

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.equals("/api/v1/health") || path.equals("/api/v1/ready");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String requestId = requestId(request.getHeader(REQUEST_ID_HEADER));
        long startedAtNanos = System.nanoTime();

        request.setAttribute(REQUEST_ID_ATTRIBUTE, requestId);
        response.setHeader(REQUEST_ID_HEADER, requestId);
        MDC.put(REQUEST_ID_ATTRIBUTE, requestId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMillis = (System.nanoTime() - startedAtNanos) / 1_000_000;
            logRequest(request, response, requestId, durationMillis);
            MDC.remove(REQUEST_ID_ATTRIBUTE);
        }
    }

    private static String requestId(String suppliedRequestId) {
        if (suppliedRequestId != null && suppliedRequestId.matches("[A-Za-z0-9-]{8,64}")) {
            return suppliedRequestId;
        }
        return UUID.randomUUID().toString();
    }

    private static void logRequest(
            HttpServletRequest request,
            HttpServletResponse response,
            String requestId,
            long durationMillis) {
        String message = "api-request requestId={} method={} path={} status={} durationMs={}";

        if (response.getStatus() >= HttpServletResponse.SC_INTERNAL_SERVER_ERROR) {
            log.error(message,
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    durationMillis);
        } else if (response.getStatus() >= HttpServletResponse.SC_BAD_REQUEST) {
            log.warn(message,
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    durationMillis);
        } else {
            log.info(message,
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    durationMillis);
        }
    }
}
