package com.moingmoing.settlement.application;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.attendance.domain.Attendance;
import com.moingmoing.attendance.domain.AttendancePaymentStatus;
import com.moingmoing.attendance.domain.AttendanceStatus;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.domain.GatheringStatus;
import com.moingmoing.attendance.infrastructure.AttendanceRepository;
import com.moingmoing.attendance.infrastructure.ClassSeriesEnrollmentRepository;
import com.moingmoing.attendance.infrastructure.GatheringRepository;
import com.moingmoing.settlement.domain.SettlementExpense;
import com.moingmoing.settlement.infrastructure.SettlementExpenseRepository;

@Service
@Transactional
public class SettlementService {
    private final AttendanceRepository attendanceRepository;
    private final GatheringRepository gatheringRepository;
    private final SettlementExpenseRepository expenseRepository;
    private final ClassSeriesEnrollmentRepository classSeriesEnrollmentRepository;

    public SettlementService(
            AttendanceRepository attendanceRepository,
            GatheringRepository gatheringRepository,
            SettlementExpenseRepository expenseRepository,
            ClassSeriesEnrollmentRepository classSeriesEnrollmentRepository) {
        this.attendanceRepository = attendanceRepository;
        this.gatheringRepository = gatheringRepository;
        this.expenseRepository = expenseRepository;
        this.classSeriesEnrollmentRepository = classSeriesEnrollmentRepository;
    }

    @Transactional(readOnly = true)
    public SettlementSummary summarize(YearMonth month) {
        Map<UUID, Gathering> gatheringsById = gatheringRepository.findAll().stream()
                .collect(Collectors.toMap(Gathering::getId, Function.identity()));
        List<Attendance> countedAttendances = attendanceRepository.findAll().stream()
                .filter(attendance -> attendance.getAttendanceStatus() == AttendanceStatus.RECORDED)
                .filter(attendance -> isInScope(gatheringsById.get(attendance.getGatheringId()), month))
                .toList();
        int collectedAmount = sumFees(countedAttendances, AttendancePaymentStatus.PAID)
                + sumPrepayments(month);
        int unpaidAmount = sumFees(countedAttendances, AttendancePaymentStatus.PENDING);
        int expenseAmount = expenseRepository.findAll().stream()
                .filter(expense -> month == null || expenseMonth(expense).equals(month))
                .mapToInt(SettlementExpense::getAmount)
                .sum();
        return new SettlementSummary(collectedAmount, unpaidAmount, expenseAmount);
    }

    @Transactional(readOnly = true)
    public Page<SettlementExpense> findExpenses(YearMonth month, int page, int size) {
        return findExpenses(month, PageRequest.of(page, size));
    }

    public SettlementExpense createExpense(
            LocalDate spentOn, YearMonth rentalMonth, String category, String description, int amount) {
        return expenseRepository.save(new SettlementExpense(
                spentOn,
                rentalMonth == null ? null : rentalMonth.atDay(1),
                category,
                description,
                amount));
    }

    private Page<SettlementExpense> findExpenses(YearMonth month, PageRequest pageRequest) {
        if (month == null) {
            return expenseRepository.findAllForSettlement(pageRequest);
        }
        return expenseRepository.findForSettlementMonth(
                month.atDay(1), month.atEndOfMonth(), pageRequest);
    }

    private YearMonth expenseMonth(SettlementExpense expense) {
        LocalDate rentalMonth = expense.getRentalMonth();
        return YearMonth.from(rentalMonth == null ? expense.getSpentOn() : rentalMonth);
    }

    private int sumFees(List<Attendance> attendances, AttendancePaymentStatus paymentStatus) {
        return attendances.stream()
                .filter(attendance -> attendance.getPaymentStatus() == paymentStatus)
                .mapToInt(Attendance::getAppliedFee)
                .sum();
    }

    private int sumPrepayments(YearMonth month) {
        List<com.moingmoing.attendance.domain.ClassSeriesEnrollment> enrollments = month == null
                ? classSeriesEnrollmentRepository.findAll()
                : classSeriesEnrollmentRepository.findByPaidOnBetween(month.atDay(1), month.atEndOfMonth());
        return enrollments.stream().mapToInt(enrollment -> enrollment.getPaidAmount()).sum();
    }

    private boolean isInScope(Gathering gathering, YearMonth month) {
        return gathering != null
                && gathering.getGatheringStatus() != GatheringStatus.CANCELLED
                && (month == null || YearMonth.from(gathering.getHeldOn()).equals(month));
    }
}
