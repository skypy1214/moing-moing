package com.moingmoing.common.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

class ApiExceptionHandlerTest {
    @Test
    void returnsFieldErrorsForValidationFailures() throws NoSuchMethodException {
        BindException bindingResult = new BindException(new Object(), "request");
        bindingResult.addError(new FieldError("request", "displayName", "이름은 필수입니다."));
        MethodParameter methodParameter = new MethodParameter(
                getClass().getDeclaredMethod("placeholder", Object.class), 0);
        MethodArgumentNotValidException exception = new MethodArgumentNotValidException(methodParameter, bindingResult);

        Map<String, Object> body = new ApiExceptionHandler().handleValidation(exception).getBody();

        assertThat(body).containsEntry("code", "VALIDATION_FAILED");
        assertThat(body).containsEntry("message", "입력값을 확인해 주세요.");
        assertThat(body).containsEntry("fieldErrors", Map.of("displayName", "이름은 필수입니다."));
    }

    private void placeholder(Object request) {
    }
}
