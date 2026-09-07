package com.moingmoing.settlement.infrastructure;

import java.time.LocalDate;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.settlement.domain.SettlementExpense;

public interface SettlementExpenseRepository extends JpaRepository<SettlementExpense, UUID> {
    Page<SettlementExpense> findBySpentOnBetweenOrderBySpentOnDescCreatedAtDesc(
            LocalDate start, LocalDate end, Pageable pageable);

    Page<SettlementExpense> findAllByOrderBySpentOnDescCreatedAtDesc(Pageable pageable);
}
