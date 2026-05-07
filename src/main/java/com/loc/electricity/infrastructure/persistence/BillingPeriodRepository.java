package com.loc.electricity.infrastructure.persistence;

import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BillingPeriodRepository extends JpaRepository<BillingPeriod, Long> {

    Optional<BillingPeriod> findFirstByStatusInOrderByStartDateDesc(List<PeriodStatus> statuses);

    boolean existsByCode(String code);

    @Query("SELECT CASE WHEN COUNT(p) > 0 THEN TRUE ELSE FALSE END FROM BillingPeriod p " +
           "WHERE p.startDate <= :endDate AND p.endDate >= :startDate")
    boolean existsByDateOverlap(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT p FROM BillingPeriod p WHERE p.status NOT IN :closedStatuses ORDER BY p.startDate DESC")
    List<BillingPeriod> findAllNotClosed(@Param("closedStatuses") List<PeriodStatus> closedStatuses);
}
