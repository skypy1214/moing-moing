package com.moingmoing.settlement.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "settlement_expenses")
public class SettlementExpense {
    @Id
    private UUID id;
    private LocalDate spentOn;
    private String category;
    private String description;
    private int amount;
    private Instant createdAt;
    private Instant updatedAt;

    protected SettlementExpense() {
    }

    public SettlementExpense(LocalDate spentOn, String category, String description, int amount) {
        if (spentOn == null) {
            throw new IllegalArgumentException("Expense date is required.");
        }
        if (category == null || category.isBlank()) {
            throw new IllegalArgumentException("Expense category is required.");
        }
        if (amount <= 0) {
            throw new IllegalArgumentException("Expense amount must be positive.");
        }
        this.id = UUID.randomUUID();
        this.spentOn = spentOn;
        this.category = category.trim();
        this.description = description == null || description.isBlank() ? null : description.trim();
        this.amount = amount;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public UUID getId() { return id; }
    public LocalDate getSpentOn() { return spentOn; }
    public String getCategory() { return category; }
    public String getDescription() { return description; }
    public int getAmount() { return amount; }
    public Instant getCreatedAt() { return createdAt; }
}
