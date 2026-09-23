package com.moingmoing.settlement.infrastructure;

import java.time.LocalDate;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.moingmoing.settlement.domain.SettlementExpense;

public interface SettlementExpenseRepository extends JpaRepository<SettlementExpense, UUID> {
    @Query("""
            select expense from SettlementExpense expense
            where (expense.rentalMonth = :monthStart)
               or (expense.rentalMonth is null and expense.spentOn between :monthStart and :monthEnd)
            order by coalesce(expense.rentalMonth, expense.spentOn) desc, expense.createdAt desc
            """)
    Page<SettlementExpense> findForSettlementMonth(
            @Param("monthStart") LocalDate monthStart,
            @Param("monthEnd") LocalDate monthEnd,
            Pageable pageable);

    @Query("""
            select expense from SettlementExpense expense
            order by coalesce(expense.rentalMonth, expense.spentOn) desc, expense.createdAt desc
            """)
    Page<SettlementExpense> findAllForSettlement(Pageable pageable);
}
