package com.loc.electricity.infrastructure.persistence;

import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BillingPeriodRepository extends JpaRepository<BillingPeriod, Long> {

    Optional<BillingPeriod> findFirstByStatusInOrderByStartDateDesc(List<PeriodStatus> statuses);

    boolean existsByCode(String code);
}
