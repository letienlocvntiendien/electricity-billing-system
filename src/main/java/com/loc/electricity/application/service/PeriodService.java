package com.loc.electricity.application.service;

import com.loc.electricity.application.dto.request.CreatePeriodRequest;
import com.loc.electricity.application.dto.request.UpdatePeriodRequest;
import com.loc.electricity.application.dto.response.PeriodReviewResponse;
import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.application.exception.ResourceNotFoundException;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.customer.Customer;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;
import com.loc.electricity.domain.reading.MeterReading;
import com.loc.electricity.domain.shared.AuditAction;
import com.loc.electricity.domain.shared.AuditEvent;
import com.loc.electricity.domain.shared.PeriodApprovedEvent;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.persistence.BillingPeriodRepository;
import com.loc.electricity.infrastructure.persistence.CustomerRepository;
import com.loc.electricity.infrastructure.persistence.MeterReadingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PeriodService {

    private final BillingPeriodRepository billingPeriodRepository;
    private final CustomerRepository customerRepository;
    private final MeterReadingRepository meterReadingRepository;
    private final BillRepository billRepository;
    private final CalculationEngine calculationEngine;
    private final PeriodWriteGuard periodWriteGuard;
    private final SystemSettingService systemSettingService;
    private final ApplicationEventPublisher eventPublisher;

    public Page<BillingPeriod> findAll(Pageable pageable) {
        return billingPeriodRepository.findAll(pageable);
    }

    public BillingPeriod findById(Long id) {
        return billingPeriodRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("BillingPeriod", id));
    }

    public BillingPeriod findCurrent() {
        return billingPeriodRepository.findFirstByStatusInOrderByStartDateDesc(
                List.of(PeriodStatus.OPEN, PeriodStatus.READING_DONE))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No active period found (OPEN or READING_DONE)"));
    }

    @Transactional
    public BillingPeriod createPeriod(CreatePeriodRequest request, User createdBy) {
        if (request.endDate().isBefore(request.startDate())) {
            throw new BusinessException("INVALID_DATE_RANGE", "end_date must be >= start_date");
        }

        String code = generateCode(request.startDate(), request.endDate());
        if (billingPeriodRepository.existsByCode(code)) {
            throw new BusinessException("DUPLICATE_PERIOD_CODE",
                    "A period with code '" + code + "' already exists");
        }

        BigDecimal serviceUnitPrice = request.serviceUnitPrice() != null
                ? request.serviceUnitPrice()
                : systemSettingService.getDecimalValue("default_service_unit_price");

        BillingPeriod period = BillingPeriod.builder()
                .code(code)
                .name(request.name())
                .startDate(request.startDate())
                .endDate(request.endDate())
                .serviceUnitPrice(serviceUnitPrice)
                .build();
        period = billingPeriodRepository.save(period);

        initMeterReadings(period);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.CREATE_PERIOD,
                "BillingPeriod", period.getId(), null, period, createdBy));

        return period;
    }

    private void initMeterReadings(BillingPeriod period) {
        List<Customer> activeCustomers = customerRepository.findAllByActiveTrue();

        List<MeterReading> readings = activeCustomers.stream().map(customer -> {
            int previousIndex = meterReadingRepository
                    .findLatestSubmittedByCustomerId(customer.getId())
                    .map(MeterReading::getCurrentIndex)
                    .orElse(0);

            return MeterReading.builder()
                    .period(period)
                    .customer(customer)
                    .previousIndex(previousIndex)
                    .currentIndex(previousIndex)
                    .build();
        }).toList();

        meterReadingRepository.saveAll(readings);
    }

    @Transactional
    public BillingPeriod update(Long id, UpdatePeriodRequest request, User updatedBy) {
        BillingPeriod period = findById(id);
        periodWriteGuard.assertWritable(period);

        BillingPeriod before = copyForAudit(period);

        if (request.name() != null) period.setName(request.name());
        if (request.extraFee() != null) period.setExtraFee(request.extraFee());
        if (request.serviceUnitPrice() != null) period.setServiceUnitPrice(request.serviceUnitPrice());

        period = billingPeriodRepository.save(period);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.CREATE_PERIOD,
                "BillingPeriod", period.getId(), before, period, updatedBy));

        return period;
    }

    public PeriodReviewResponse review(Long id) {
        BillingPeriod period = findById(id);

        List<MeterReading> submitted = meterReadingRepository.findAllByPeriodId(id)
                .stream().filter(r -> r.getReadAt() != null).toList();

        int totalConsumption = submitted.stream().mapToInt(MeterReading::computedConsumption).sum();

        BigDecimal previewUnitPrice;
        if (totalConsumption == 0) {
            previewUnitPrice = BigDecimal.ZERO;
        } else {
            previewUnitPrice = period.getEvnTotalAmount().add(period.getExtraFee())
                    .divide(new BigDecimal(totalConsumption), 0, RoundingMode.HALF_UP);
        }

        BigDecimal totalBillsAmount = submitted.stream()
                .map(r -> previewUnitPrice.add(period.getServiceUnitPrice())
                        .multiply(new BigDecimal(r.computedConsumption())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal roundingDifference = totalConsumption == 0
                ? BigDecimal.ZERO
                : period.getEvnTotalAmount().add(period.getExtraFee())
                        .subtract(previewUnitPrice.multiply(new BigDecimal(totalConsumption)));

        return new PeriodReviewResponse(
                period.getEvnTotalAmount(),
                period.getExtraFee(),
                totalConsumption,
                previewUnitPrice,
                period.getServiceUnitPrice(),
                totalBillsAmount,
                roundingDifference,
                submitted.size());
    }

    @Transactional
    public BillingPeriod calculate(Long id, User calculatedBy) {
        BillingPeriod period = findById(id);
        periodWriteGuard.assertStatus(period, PeriodStatus.READING_DONE);

        List<MeterReading> submitted = meterReadingRepository.findAllByPeriodId(id)
                .stream().filter(r -> r.getReadAt() != null).toList();

        List<CalculationEngine.ReadingInput> inputs = submitted.stream()
                .map(r -> new CalculationEngine.ReadingInput(
                        r.getCustomer().getId(), r.getId(), r.computedConsumption()))
                .toList();

        CalculationEngine.CalculationOutput result = calculationEngine.calculate(
                period.getEvnTotalAmount(), period.getExtraFee(),
                period.getServiceUnitPrice(), inputs);

        final BillingPeriod savedPeriod = period;
        List<Bill> bills = result.bills().stream().map(b -> {
            MeterReading reading = submitted.stream()
                    .filter(r -> r.getId().equals(b.readingId())).findFirst().orElseThrow();
            String paymentCode = "TIENDIEN " + savedPeriod.getCode() + " " + reading.getCustomer().getCode();
            return Bill.builder()
                    .period(savedPeriod)
                    .customer(reading.getCustomer())
                    .consumption(b.consumption())
                    .unitPrice(b.unitPrice())
                    .serviceUnitPrice(b.serviceUnitPrice())
                    .electricityAmount(b.electricityAmount())
                    .serviceAmount(b.serviceAmount())
                    .totalAmount(b.totalAmount())
                    .status(b.status())
                    .paymentCode(paymentCode)
                    .build();
        }).toList();

        billRepository.saveAll(bills);

        period.setUnitPrice(result.unitPrice());
        period.setStatus(PeriodStatus.CALCULATED);
        period = billingPeriodRepository.save(period);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.CALCULATE_PERIOD,
                "BillingPeriod", period.getId(), null, period, calculatedBy));

        return period;
    }

    @Transactional
    public BillingPeriod approve(Long id, User approvedBy) {
        BillingPeriod period = findById(id);
        periodWriteGuard.assertStatus(period, PeriodStatus.CALCULATED);

        period.setStatus(PeriodStatus.APPROVED);
        period.setApprovedBy(approvedBy);
        period.setApprovedAt(LocalDateTime.now());
        period = billingPeriodRepository.save(period);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.APPROVE_PERIOD,
                "BillingPeriod", period.getId(), null, period, approvedBy));
        eventPublisher.publishEvent(new PeriodApprovedEvent(this, period.getId()));

        return period;
    }

    @Transactional
    public BillingPeriod revert(Long id, User revertedBy) {
        BillingPeriod period = findById(id);
        periodWriteGuard.assertStatus(period, PeriodStatus.CALCULATED);

        BillingPeriod before = copyForAudit(period);

        billRepository.deleteByPeriodId(id);

        period.setUnitPrice(null);
        period.setStatus(PeriodStatus.OPEN);
        period = billingPeriodRepository.save(period);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.REVERT_PERIOD,
                "BillingPeriod", period.getId(), before, period, revertedBy));

        return period;
    }

    @Transactional
    public BillingPeriod close(Long id, User closedBy) {
        BillingPeriod period = findById(id);
        periodWriteGuard.assertStatus(period, PeriodStatus.APPROVED);

        period.setStatus(PeriodStatus.CLOSED);
        period.setClosedAt(LocalDateTime.now());
        period = billingPeriodRepository.save(period);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.CLOSE_PERIOD,
                "BillingPeriod", period.getId(), null, period, closedBy));

        return period;
    }

    private BillingPeriod copyForAudit(BillingPeriod src) {
        BillingPeriod copy = new BillingPeriod();
        copy.setId(src.getId());
        copy.setCode(src.getCode());
        copy.setStatus(src.getStatus());
        copy.setExtraFee(src.getExtraFee());
        copy.setUnitPrice(src.getUnitPrice());
        return copy;
    }

    private String generateCode(LocalDate startDate, LocalDate endDate) {
        if (startDate.getMonth() == endDate.getMonth() && startDate.getYear() == endDate.getYear()) {
            return startDate.format(DateTimeFormatter.ofPattern("yyyy-MM"));
        }
        return startDate.format(DateTimeFormatter.ofPattern("yyyy-MM"))
                + "_" + endDate.format(DateTimeFormatter.ofPattern("yyyy-MM"));
    }
}
