package com.moingmoing.settlement.application;

public record SettlementSummary(int collectedAmount, int unpaidAmount, int expenseAmount) {
    public int netAmount() {
        return collectedAmount - expenseAmount;
    }
}
