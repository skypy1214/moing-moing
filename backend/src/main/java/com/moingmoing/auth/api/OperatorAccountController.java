package com.moingmoing.auth.api;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.moingmoing.auth.application.OperatorAccountService;
import com.moingmoing.auth.domain.AccountStatus;
import com.moingmoing.auth.domain.RoleCode;
import com.moingmoing.auth.domain.UserAccount;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/v1/admin/accounts")
@Validated
class OperatorAccountController {
    private final OperatorAccountService operatorAccountService;

    OperatorAccountController(OperatorAccountService operatorAccountService) {
        this.operatorAccountService = operatorAccountService;
    }

    @GetMapping
    List<AccountResponse> findAll() {
        return operatorAccountService.findAll().stream().map(AccountResponse::from).toList();
    }

    @PostMapping
    ResponseEntity<AccountResponse> create(@Valid @RequestBody CreateAccountRequest request) {
        return ResponseEntity.status(201).body(AccountResponse.from(operatorAccountService.create(
                request.loginId(), request.displayName(), request.password(), request.role())));
    }

    @PatchMapping("/{accountId}")
    ResponseEntity<Void> update(
            @PathVariable UUID accountId,
            @Valid @RequestBody UpdateAccountRoleRequest request) {
        operatorAccountService.updateRole(accountId, request.role());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{accountId}/disable")
    ResponseEntity<Void> disable(@PathVariable UUID accountId) {
        operatorAccountService.disable(accountId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{accountId}/activate")
    ResponseEntity<Void> activate(@PathVariable UUID accountId) {
        operatorAccountService.activate(accountId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{accountId}/reset-password")
    ResetPasswordResponse resetPassword(@PathVariable UUID accountId) {
        return ResetPasswordResponse.from(operatorAccountService.resetPassword(accountId));
    }

    private record CreateAccountRequest(
            @NotBlank @Pattern(regexp = "[A-Za-z0-9._-]{3,80}") String loginId,
            @NotBlank @Size(max = 100) String displayName,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotNull RoleCode role) {
    }

    private record UpdateAccountRoleRequest(@NotNull RoleCode role) {
    }

    private record ResetPasswordResponse(String temporaryPassword) {
        private static ResetPasswordResponse from(OperatorAccountService.ResetPasswordResult result) {
            return new ResetPasswordResponse(result.temporaryPassword());
        }
    }

    private record AccountResponse(
            UUID id,
            String loginId,
            String displayName,
            RoleCode role,
            AccountStatus status) {
        private static AccountResponse from(UserAccount account) {
            return new AccountResponse(
                    account.getId(),
                    account.getLoginId(),
                    account.getDisplayName(),
                    account.getPrimaryRole(),
                    account.getAccountStatus());
        }

        private static AccountResponse from(OperatorAccountService.AccountSummary account) {
            return new AccountResponse(
                    account.id(), account.loginId(), account.displayName(), account.role(), account.status());
        }
    }
}
