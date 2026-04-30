package com.loc.electricity.infrastructure.persistence;

import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface BillRepository extends JpaRepository<Bill, Long> {

    List<Bill> findAllByPeriodId(Long periodId);

    List<Bill> findAllByPeriodIdAndStatus(Long periodId, BillStatus status);

    Optional<Bill> findByPaymentCode(String paymentCode);

    void deleteByPeriodId(Long periodId);

    @Query("SELECT b FROM Bill b JOIN FETCH b.customer JOIN FETCH b.period WHERE b.status IN :statuses ORDER BY b.customer.code")
    List<Bill> findUnpaidBills(List<BillStatus> statuses);

    @Query("SELECT b FROM Bill b WHERE b.period.id = :periodId AND b.status IN :statuses AND b.period.approvedAt IS NOT NULL")
    Page<Bill> findByPeriodIdAndStatusIn(Long periodId, List<BillStatus> statuses, Pageable pageable);
}
