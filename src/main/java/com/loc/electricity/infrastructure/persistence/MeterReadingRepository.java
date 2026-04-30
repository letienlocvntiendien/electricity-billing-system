package com.loc.electricity.infrastructure.persistence;

import com.loc.electricity.domain.reading.MeterReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface MeterReadingRepository extends JpaRepository<MeterReading, Long> {

    List<MeterReading> findAllByPeriodId(Long periodId);

    Optional<MeterReading> findByPeriodIdAndCustomerId(Long periodId, Long customerId);

    // Unsubmitted readings have read_at IS NULL
    long countByPeriodIdAndReadAtIsNull(Long periodId);

    // Last 3 submitted readings for anomaly check
    @Query("SELECT r FROM MeterReading r WHERE r.customer.id = :customerId AND r.readAt IS NOT NULL ORDER BY r.readAt DESC LIMIT 3")
    List<MeterReading> findTop3ByCustomerIdOrderByReadAtDesc(Long customerId);

    // Most recent submitted reading to carry over previous_index for new period
    @Query("SELECT r FROM MeterReading r WHERE r.customer.id = :customerId AND r.readAt IS NOT NULL ORDER BY r.readAt DESC LIMIT 1")
    Optional<MeterReading> findLatestSubmittedByCustomerId(Long customerId);
}
