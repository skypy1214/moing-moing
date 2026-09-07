package com.moingmoing.settlement.api;

import java.net.URI;
import java.time.DateTimeException;
import java.time.YearMonth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;

import com.moingmoing.settlement.application.SettlementService;
import com.moingmoing.settlement.application.SettlementSummary;
import com.moingmoing.settlement.domain.SettlementExpense;

@RestController
@Validated
@RequestMapping("/api/v1/settlements")
class SettlementController {
    private final SettlementService settlementService;

    SettlementController(SettlementService settlementService) {
        this.settlementService = settlementService;
    }

    @GetMapping
    SettlementResponse settlement(
            @RequestParam(required = false) @Pattern(regexp = "\\d{4}-\\d{2}") String month,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        YearMonth selectedMonth = parseMonth(month);
        SettlementSummary summary = settlementService.summarize(selectedMonth);
        Page<SettlementExpense> expenses = settlementService.findExpenses(selectedMonth, page, size);
        return SettlementResponse.from(month, summary, expenses);
    }

    @PostMapping("/expenses")
    ResponseEntity<SettlementExpenseResponse> createExpense(
            @Valid @RequestBody CreateSettlementExpenseRequest request) {
        SettlementExpense expense = settlementService.createExpense(
                request.spentOn(), request.category(), request.description(), request.amount());
        return ResponseEntity.created(URI.create("/api/v1/settlements/expenses/" + expense.getId()))
                .body(SettlementExpenseResponse.from(expense));
    }

    private YearMonth parseMonth(String month) {
        if (month == null) {
            return null;
        }
        try {
            return YearMonth.parse(month);
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("month must use YYYY-MM format.");
        }
    }
}

record CreateSettlementExpenseRequest(
        @NotNull java.time.LocalDate spentOn,
        @NotBlank @Size(max = 100) String category,
        @Size(max = 200) String description,
        @Positive int amount) {
}

record SettlementResponse(
        String month,
        int collectedAmount,
        int unpaidAmount,
        int expenseAmount,
        int netAmount,
        java.util.List<SettlementExpenseResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages) {
    static SettlementResponse from(String month, SettlementSummary summary, Page<SettlementExpense> expenses) {
        return new SettlementResponse(
                month,
                summary.collectedAmount(),
                summary.unpaidAmount(),
                summary.expenseAmount(),
                summary.netAmount(),
                expenses.getContent().stream().map(SettlementExpenseResponse::from).toList(),
                expenses.getNumber(), expenses.getSize(), expenses.getTotalElements(), expenses.getTotalPages());
    }
}

record SettlementExpenseResponse(
        java.util.UUID id,
        java.time.LocalDate spentOn,
        String category,
        String description,
        int amount) {
    static SettlementExpenseResponse from(SettlementExpense expense) {
        return new SettlementExpenseResponse(
                expense.getId(),
                expense.getSpentOn(),
                expense.getCategory(),
                expense.getDescription(),
                expense.getAmount());
    }
}
