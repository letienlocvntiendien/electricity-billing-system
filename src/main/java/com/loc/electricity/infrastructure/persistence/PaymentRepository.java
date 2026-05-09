package com.loc.electricity.infrastructure.persistence;

import com.loc.electricity.domain.payment.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    boolean existsByBankTransactionId(String bankTransactionId);

    Page<Payment> findByBillIdIsNull(Pageable pageable);

    List<Payment> findByBillIdOrderByPaidAtDesc(Long billId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.bill.id = :billId")
    BigDecimal sumAmountByBillId(Long billId);

    @Modifying
    @Query("UPDATE Payment p SET p.bill = null WHERE p.bill.id IN (SELECT b.id FROM Bill b WHERE b.period.id = :periodId)")
    void detachByPeriodId(@Param("periodId") Long periodId);
}
