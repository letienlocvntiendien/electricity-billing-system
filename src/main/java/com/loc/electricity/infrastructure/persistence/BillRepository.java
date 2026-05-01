package com.loc.electricity.infrastructure.persistence;

import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BillRepository extends JpaRepository<Bill, Long> {

    @Query("SELECT b FROM Bill b JOIN FETCH b.customer JOIN FETCH b.period WHERE b.period.id = :periodId ORDER BY b.customer.code")
    List<Bill> findAllByPeriodId(@Param("periodId") Long periodId);

    @Query("SELECT b FROM Bill b JOIN FETCH b.customer JOIN FETCH b.period WHERE b.period.id = :periodId AND b.status = :status ORDER BY b.customer.code")
    List<Bill> findAllByPeriodIdAndStatus(@Param("periodId") Long periodId, @Param("status") BillStatus status);

    Optional<Bill> findByPaymentCode(String paymentCode);

    void deleteByPeriodId(Long periodId);

    @Query("SELECT b FROM Bill b JOIN FETCH b.customer JOIN FETCH b.period WHERE b.status IN :statuses ORDER BY b.customer.code")
    List<Bill> findUnpaidBills(@Param("statuses") List<BillStatus> statuses);

    @Modifying
    @Query("UPDATE Bill b SET b.status = :overdueStatus WHERE b.status IN :statuses AND b.period.approvedAt < :cutoff")
    int markOverdue(@Param("overdueStatus") BillStatus overdueStatus,
                    @Param("statuses") List<BillStatus> statuses,
                    @Param("cutoff") LocalDateTime cutoff);
}
