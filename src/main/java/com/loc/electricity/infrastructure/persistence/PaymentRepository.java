package com.loc.electricity.infrastructure.persistence;

import com.loc.electricity.domain.payment.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    boolean existsByBankTransactionId(String bankTransactionId);

    Page<Payment> findByBillIdIsNull(Pageable pageable);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.bill.id = :billId")
    BigDecimal sumAmountByBillId(Long billId);
}
