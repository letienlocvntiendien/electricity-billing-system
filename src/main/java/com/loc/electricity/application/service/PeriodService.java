package com.loc.electricity.application.service;

import com.loc.electricity.application.dto.request.CreatePeriodRequest;
import com.loc.electricity.application.dto.request.UpdatePeriodRequest;
import com.loc.electricity.application.dto.response.PeriodReviewResponse;
import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.application.exception.ResourceNotFoundException;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.customer.Customer;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.EvnInvoice;
import com.loc.electricity.domain.period.PeriodStatus;
import com.loc.electricity.domain.reading.MeterReading;
import com.loc.electricity.domain.shared.AuditAction;
import com.loc.electricity.domain.shared.AuditEvent;
import com.loc.electricity.domain.shared.PeriodApprovedEvent;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.persistence.BillingPeriodRepository;
import com.loc.electricity.infrastructure.persistence.CustomerRepository;
import com.loc.electricity.infrastructure.persistence.EvnInvoiceRepository;
import com.loc.electricity.infrastructure.persistence.MeterReadingRepository;
import com.loc.electricity.infrastructure.persistence.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Manages the billing period lifecycle, including all state machine transitions
 * from OPEN through CLOSED, billing calculation, and review support.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PeriodService {

    private final BillingPeriodRepository billingPeriodRepository;
    private final CustomerRepository customerRepository;
    private final MeterReadingRepository meterReadingRepository;
    private final BillRepository billRepository;
    private final PaymentRepository paymentRepository;
    private final EvnInvoiceRepository evnInvoiceRepository;
    private final CalculationEngine calculationEngine;
    private final PeriodWriteGuard periodWriteGuard;
    private final SystemSettingService systemSettingService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Returns all billing periods, paginated and sorted as requested.
     *
     * @param pageable pagination and sorting parameters
     * @return page of billing periods
     */
    public Page<BillingPeriod> findAll(Pageable pageable) {
        return billingPeriodRepository.findAll(pageable);
    }

    /**
     * Finds a billing period by ID.
     *
     * @param id the period ID
     * @return the billing period
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if not found
     */
    public BillingPeriod findById(Long id) {
        return billingPeriodRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("BillingPeriod", id));
    }

    /**
     * Returns the current active billing period — the most recent one in OPEN or READING_DONE status.
     *
     * @return the active billing period
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if no active period exists
     */
    public BillingPeriod findCurrent() {
        return billingPeriodRepository.findFirstByStatusInOrderByStartDateDesc(
                List.of(PeriodStatus.OPEN, PeriodStatus.READING_DONE))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No active period found (OPEN or READING_DONE)"));
    }

    /**
     * Creates a new billing period in OPEN status. Validates date range, prevents overlap with existing
     * periods, and seeds meter reading slots for all currently active customers.
     *
     * @param request   period details (name, startDate, endDate, serviceFee, extraFee)
     * @param createdBy the user performing the action
     * @return the persisted billing period
     * @throws com.loc.electricity.application.exception.BusinessException if dates are invalid or overlap an existing period
     */
    @Transactional
    public BillingPeriod createPeriod(CreatePeriodRequest request, User createdBy) {
        if (request.endDate().isBefore(request.startDate())) {
            throw new BusinessException("INVALID_DATE_RANGE", "end_date must be >= start_date");
        }

        if (billingPeriodRepository.existsByDateOverlap(request.startDate(), request.endDate())) {
            throw new BusinessException("PERIOD_DATE_OVERLAP",
                    "Khoảng thời gian này trùng lặp với kỳ điện đã tồn tại.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        String code = generateCode(request.startDate(), request.endDate());
        if (billingPeriodRepository.existsByCode(code)) {
            throw new BusinessException("DUPLICATE_PERIOD_CODE",
                    "A period with code '" + code + "' already exists");
        }

        BigDecimal serviceFee = request.serviceFee() != null
                ? request.serviceFee()
                : systemSettingService.getDecimalValue("default_service_fee");

        BillingPeriod period = BillingPeriod.builder()
                .code(code)
                .name(request.name())
                .startDate(request.startDate())
                .endDate(request.endDate())
                .serviceFee(serviceFee)
                .build();
        period = billingPeriodRepository.save(period);
        log.info("Period created: id={} code={} serviceFee={}", period.getId(), period.getCode(), serviceFee);

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
        log.info("Initialized {} meter readings for period {}", readings.size(), period.getId());
    }

    /**
     * Updates the period's name, extraFee, or serviceFee. Blocked when APPROVED or CLOSED.
     *
     * @param id        the period ID
     * @param request   fields to update (null fields are ignored)
     * @param updatedBy the user performing the action
     * @return the updated period
     * @throws com.loc.electricity.application.exception.PeriodLockedException if the period is APPROVED or CLOSED
     */
    @Transactional
    public BillingPeriod update(Long id, UpdatePeriodRequest request, User updatedBy) {
        BillingPeriod period = findById(id);
        periodWriteGuard.assertWritable(period);

        BillingPeriod before = copyForAudit(period);

        if (request.name() != null) period.setName(request.name());
        if (request.extraFee() != null) period.setExtraFee(request.extraFee());
        if (request.serviceFee() != null) period.setServiceFee(request.serviceFee());

        period = billingPeriodRepository.save(period);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.UPDATE_PERIOD,
                "BillingPeriod", period.getId(), before, period, updatedBy));

        return period;
    }

    /**
     * Transitions the period from OPEN to READING_DONE, signalling that all meter readings
     * have been collected. Only METER_READER role may trigger this transition.
     *
     * @param id          the period ID
     * @param submittedBy the METER_READER performing the submission
     * @return the updated period
     * @throws com.loc.electricity.application.exception.InvalidStateTransitionException if not in OPEN status
     */
    @Transactional
    public BillingPeriod submitReadings(Long id, User submittedBy) {
        BillingPeriod period = findById(id);
        periodWriteGuard.assertStatus(period, PeriodStatus.OPEN);

        period.setStatus(PeriodStatus.READING_DONE);
        period = billingPeriodRepository.save(period);
        log.info("Readings submitted for period {} by {}", id, submittedBy.getUsername());

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.SUBMIT_READINGS,
                "BillingPeriod", period.getId(), null, period, submittedBy));

        return period;
    }

    /**
     * Returns a pre-calculation review for the period, including EVN totals, actual customer consumption,
     * line-loss analysis, a preview unit price, and accountant verification status.
     * Does not mutate any state.
     *
     * @param id the period ID
     * @return the review summary
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if not found
     */
    public PeriodReviewResponse review(Long id) {
        BillingPeriod period = findById(id);

        List<EvnInvoice> invoices = evnInvoiceRepository.findAllByPeriodId(id);
        int evnTotalKwh = invoices.stream().mapToInt(EvnInvoice::getKwh).sum();
        BigDecimal evnTotalAmount = invoices.stream().map(EvnInvoice::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<MeterReading> submitted = meterReadingRepository.findAllByPeriodId(id)
                .stream().filter(r -> r.getReadAt() != null).toList();

        int totalActualConsumption = submitted.stream().mapToInt(MeterReading::computedConsumption).sum();

        int lossKwh = evnTotalKwh - totalActualConsumption;
        double lossPercentage = evnTotalKwh > 0
                ? (double) lossKwh / evnTotalKwh * 100.0
                : 0.0;

        int lossThreshold;
        try {
            lossThreshold = systemSettingService.getIntValue("loss_warning_threshold");
        } catch (Exception e) {
            lossThreshold = 15;
        }
        boolean lossWarning = lossPercentage > lossThreshold;

        BigDecimal previewUnitPrice;
        if (totalActualConsumption == 0) {
            previewUnitPrice = BigDecimal.ZERO;
        } else {
            previewUnitPrice = evnTotalAmount.add(period.getExtraFee())
                    .divide(new BigDecimal(totalActualConsumption), 2, RoundingMode.HALF_UP);
        }

        int activeBillCount = (int) customerRepository.findAllByActiveTrue().size();
        BigDecimal serviceFee = period.getServiceFee();

        // total bills = Σ (consumption × unitPrice) + activeBillCount × serviceFee
        BigDecimal totalBillsAmount = submitted.stream()
                .map(r -> previewUnitPrice.multiply(new BigDecimal(r.computedConsumption()))
                        .setScale(0, RoundingMode.HALF_UP)
                        .add(serviceFee))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Rounding difference: expected vs sum of electricity portions only
        BigDecimal roundingDifference = totalActualConsumption == 0
                ? BigDecimal.ZERO
                : evnTotalAmount.add(period.getExtraFee())
                        .subtract(previewUnitPrice.multiply(new BigDecimal(totalActualConsumption)));

        String verifiedBy = period.getAccountantVerifiedBy() != null
                ? period.getAccountantVerifiedBy().getFullName()
                : null;

        return new PeriodReviewResponse(
                evnTotalKwh, evnTotalAmount,
                period.getExtraFee(),
                totalActualConsumption,
                lossKwh, lossPercentage, lossWarning,
                previewUnitPrice,
                serviceFee,
                activeBillCount,
                totalBillsAmount,
                roundingDifference,
                submitted.size(),
                verifiedBy,
                period.getAccountantVerifiedAt());
    }

    /**
     * Runs the Spec V2 billing formula against all submitted readings and the EVN invoice totals,
     * persists the resulting bills, and transitions the period to CALCULATED.
     *
     * @param id           the period ID
     * @param calculatedBy the ACCOUNTANT or ADMIN performing the calculation
     * @return the updated period
     * @throws com.loc.electricity.application.exception.InvalidStateTransitionException if not in READING_DONE
     * @throws com.loc.electricity.application.exception.BusinessException               if no EVN invoice exists
     */
    @Transactional
    public BillingPeriod calculate(Long id, User calculatedBy) {
        BillingPeriod period = findById(id);
        periodWriteGuard.assertStatus(period, PeriodStatus.READING_DONE);

        List<EvnInvoice> invoices = evnInvoiceRepository.findAllByPeriodId(id);
        if (invoices.isEmpty()) {
            throw new BusinessException("NO_EVN_INVOICE",
                    "Chưa có hóa đơn EVN nào cho kỳ này.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        List<MeterReading> submitted = meterReadingRepository.findAllByPeriodId(id)
                .stream().filter(r -> r.getReadAt() != null).toList();

        List<CalculationEngine.ReadingInput> inputs = submitted.stream()
                .map(r -> new CalculationEngine.ReadingInput(
                        r.getCustomer().getId(), r.getId(), r.computedConsumption()))
                .toList();

        CalculationEngine.CalculationOutput result = calculationEngine.calculate(
                period.getEvnTotalAmount(), period.getExtraFee(),
                period.getServiceFee(), inputs);

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
                    .serviceFee(b.serviceFee())
                    .electricityAmount(b.electricityAmount())
                    .serviceAmount(b.serviceAmount())
                    .totalAmount(b.totalAmount())
                    .status(b.status())
                    .paymentCode(paymentCode)
                    .build();
        }).toList();

        billRepository.saveAll(bills);
        log.info("Period {} calculated: unitPrice={} bills={}", period.getId(), result.unitPrice(), bills.size());

        period.setUnitPrice(result.unitPrice());
        period.setStatus(PeriodStatus.CALCULATED);
        period = billingPeriodRepository.save(period);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.CALCULATE_PERIOD,
                "BillingPeriod", period.getId(), null, period, calculatedBy));

        return period;
    }

    /**
     * Records accountant verification of the period's EVN invoice reconciliation.
     * Sets {@code accountantVerifiedBy} and {@code accountantVerifiedAt}. Period remains CALCULATED.
     *
     * @param id         the period ID
     * @param verifiedBy the ACCOUNTANT or ADMIN performing the verification
     * @return the updated period
     * @throws com.loc.electricity.application.exception.InvalidStateTransitionException if not in CALCULATED
     */
    @Transactional
    public BillingPeriod verify(Long id, User verifiedBy) {
        BillingPeriod period = findById(id);
        periodWriteGuard.assertStatus(period, PeriodStatus.CALCULATED);

        period.setAccountantVerifiedBy(verifiedBy);
        period.setAccountantVerifiedAt(LocalDateTime.now());
        period = billingPeriodRepository.save(period);
        log.info("Period {} verified by {}", id, verifiedBy.getUsername());

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.VERIFY_PERIOD,
                "BillingPeriod", period.getId(), null, period, verifiedBy));

        return period;
    }

    /**
     * Transitions the period to APPROVED and triggers asynchronous PDF/QR generation for all bills.
     * Requires prior accountant verification ({@code accountantVerifiedAt} must be set).
     *
     * @param id         the period ID
     * @param approvedBy the ADMIN performing the approval
     * @return the updated period
     * @throws com.loc.electricity.application.exception.InvalidStateTransitionException if not in CALCULATED
     * @throws com.loc.electricity.application.exception.BusinessException               if not yet verified by accountant
     */
    @Transactional
    public BillingPeriod approve(Long id, User approvedBy) {
        BillingPeriod period = findById(id);
        periodWriteGuard.assertStatus(period, PeriodStatus.CALCULATED);

        if (period.getAccountantVerifiedAt() == null) {
            throw new BusinessException("NOT_VERIFIED",
                    "Kế toán chưa đối chiếu hóa đơn EVN. Không thể phê duyệt.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        period.setStatus(PeriodStatus.APPROVED);
        period.setApprovedBy(approvedBy);
        period.setApprovedAt(LocalDateTime.now());
        period = billingPeriodRepository.save(period);
        log.info("Period {} approved by {}", id, approvedBy.getUsername());

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.APPROVE_PERIOD,
                "BillingPeriod", period.getId(), null, period, approvedBy));
        eventPublisher.publishEvent(new PeriodApprovedEvent(this, period.getId()));

        return period;
    }

    /**
     * Reverts the period back to OPEN from CALCULATED or APPROVED. Deletes all bills for the period,
     * detaches their payments, and clears verified/approved metadata.
     *
     * @param id         the period ID
     * @param revertedBy the ADMIN performing the revert
     * @return the updated period
     * @throws com.loc.electricity.application.exception.BusinessException if the period is not in CALCULATED or APPROVED
     */
    @Transactional
    public BillingPeriod revert(Long id, User revertedBy) {
        BillingPeriod period = findById(id);
        // Allow revert from CALCULATED or APPROVED
        if (period.getStatus() != PeriodStatus.CALCULATED && period.getStatus() != PeriodStatus.APPROVED) {
            throw new BusinessException("INVALID_STATE",
                    "Revert only allowed from CALCULATED or APPROVED",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        BillingPeriod before = copyForAudit(period);

        paymentRepository.detachByPeriodId(id);
        billRepository.deleteByPeriodId(id);

        period.setUnitPrice(null);
        period.setAccountantVerifiedBy(null);
        period.setAccountantVerifiedAt(null);
        period.setApprovedBy(null);
        period.setApprovedAt(null);
        period.setStatus(PeriodStatus.OPEN);
        period = billingPeriodRepository.save(period);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.REVERT_PERIOD,
                "BillingPeriod", period.getId(), before, period, revertedBy));

        return period;
    }

    /**
     * Transitions the period to CLOSED. Blocked if any bills remain unpaid.
     *
     * @param id       the period ID
     * @param closedBy the ADMIN performing the close
     * @return the updated period
     * @throws com.loc.electricity.application.exception.InvalidStateTransitionException if not in APPROVED
     * @throws com.loc.electricity.application.exception.BusinessException               if there are unpaid bills
     */
    @Transactional
    public BillingPeriod close(Long id, User closedBy) {
        BillingPeriod period = findById(id);
        periodWriteGuard.assertStatus(period, PeriodStatus.APPROVED);

        long unpaidCount = billRepository.countUnpaidByPeriodId(id,
                List.of(BillStatus.PAID));
        if (unpaidCount > 0) {
            throw new BusinessException("UNPAID_BILLS",
                    unpaidCount + " hóa đơn chưa thanh toán. Vui lòng hoàn tất thu tiền trước khi đóng kỳ.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        period.setStatus(PeriodStatus.CLOSED);
        period.setClosedAt(LocalDateTime.now());
        period = billingPeriodRepository.save(period);
        log.info("Period {} closed by {}", id, closedBy.getUsername());

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
