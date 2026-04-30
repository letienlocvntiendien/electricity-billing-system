package com.loc.electricity.infrastructure.persistence;

import com.loc.electricity.domain.period.EvnInvoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;

public interface EvnInvoiceRepository extends JpaRepository<EvnInvoice, Long> {

    List<EvnInvoice> findAllByPeriodId(Long periodId);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM EvnInvoice e WHERE e.period.id = :periodId")
    BigDecimal sumAmountByPeriodId(Long periodId);

    @Query("SELECT COALESCE(SUM(e.kwh), 0) FROM EvnInvoice e WHERE e.period.id = :periodId")
    int sumKwhByPeriodId(Long periodId);
}
