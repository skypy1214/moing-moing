package com.moingmoing.audit.infrastructure;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class AuditWebConfiguration implements WebMvcConfigurer {
    private final AuditActivityInterceptor auditActivityInterceptor;

    AuditWebConfiguration(AuditActivityInterceptor auditActivityInterceptor) {
        this.auditActivityInterceptor = auditActivityInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(auditActivityInterceptor).addPathPatterns("/api/v1/**");
    }
}
