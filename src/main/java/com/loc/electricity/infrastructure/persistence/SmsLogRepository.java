package com.loc.electricity.infrastructure.persistence;

import com.loc.electricity.domain.sms.SmsLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SmsLogRepository extends JpaRepository<SmsLog, Long> {
    List<SmsLog> findByBillIdOrderBySentAtDesc(Long billId);
}
