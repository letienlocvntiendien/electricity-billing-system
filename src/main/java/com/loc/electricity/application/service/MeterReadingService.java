package com.loc.electricity.application.service;

import com.loc.electricity.application.dto.request.UpdateMeterReadingRequest;
import com.loc.electricity.application.dto.response.MeterReadingResponse;
import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.application.exception.ResourceNotFoundException;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;
import com.loc.electricity.domain.reading.MeterReading;
import com.loc.electricity.domain.shared.AuditAction;
import com.loc.electricity.domain.shared.AuditEvent;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.MeterReadingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MeterReadingService {

    private final MeterReadingRepository meterReadingRepository;
    private final SystemSettingService systemSettingService;
    private final ApplicationEventPublisher eventPublisher;

    public List<MeterReading> findByPeriodId(Long periodId) {
        return meterReadingRepository.findAllByPeriodId(periodId);
    }

    public MeterReading findById(Long id) {
        return meterReadingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("MeterReading", id));
    }

    @Transactional
    public MeterReadingResponse submitReading(Long id, UpdateMeterReadingRequest request, User submittedBy) {
        MeterReading reading = findById(id);
        BillingPeriod period = reading.getPeriod();

        if (period.getStatus() != PeriodStatus.OPEN) {
            throw new BusinessException("PERIOD_NOT_OPEN",
                    "Readings can only be submitted when period is OPEN",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        if (request.currentIndex() < reading.getPreviousIndex()) {
            throw new BusinessException("INVALID_INDEX",
                    "current_index (" + request.currentIndex()
                            + ") must be >= previous_index (" + reading.getPreviousIndex() + ")");
        }

        MeterReading before = shallowCopy(reading);

        reading.setCurrentIndex(request.currentIndex());
        if (request.readingPhotoUrl() != null) {
            reading.setReadingPhotoUrl(request.readingPhotoUrl());
        }
        reading.setReadAt(LocalDateTime.now());
        reading.setReadBy(submittedBy);

        reading = meterReadingRepository.save(reading);

        String warning = checkAnomaly(reading);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.UPDATE_METER_READING,
                "MeterReading", reading.getId(), before, reading, submittedBy));

        return MeterReadingResponse.from(reading, warning);
    }

    private String checkAnomaly(MeterReading reading) {
        int anomalyThreshold;
        try {
            anomalyThreshold = systemSettingService.getIntValue("reading_anomaly_threshold");
        } catch (Exception e) {
            anomalyThreshold = 300;
        }

        List<MeterReading> recent = meterReadingRepository
                .findTop3ByCustomerIdOrderByReadAtDesc(reading.getCustomer().getId());

        if (recent.isEmpty()) return null;

        double avgConsumption = recent.stream()
                .mapToInt(MeterReading::computedConsumption)
                .average()
                .orElse(0);

        if (avgConsumption == 0) return null;

        int currentConsumption = reading.computedConsumption();
        double deviation = Math.abs((currentConsumption - avgConsumption) / avgConsumption) * 100;

        if (deviation > anomalyThreshold) {
            return String.format("Consumption %d kWh deviates %.0f%% from the average of recent 3 periods (%.0f kWh)",
                    currentConsumption, deviation, avgConsumption);
        }
        return null;
    }

    private MeterReading shallowCopy(MeterReading r) {
        MeterReading copy = new MeterReading();
        copy.setId(r.getId());
        copy.setPreviousIndex(r.getPreviousIndex());
        copy.setCurrentIndex(r.getCurrentIndex());
        copy.setReadAt(r.getReadAt());
        return copy;
    }
}
