package com.loc.electricity.application.service;

import com.loc.electricity.application.dto.request.CreateEvnInvoiceRequest;
import com.loc.electricity.application.dto.request.UpdateEvnInvoiceRequest;
import com.loc.electricity.application.exception.ResourceNotFoundException;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.EvnInvoice;
import com.loc.electricity.domain.shared.AuditAction;
import com.loc.electricity.domain.shared.AuditEvent;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.BillingPeriodRepository;
import com.loc.electricity.infrastructure.persistence.EvnInvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Manages EVN master invoice records for billing periods.
 * All mutations are blocked when the period is in APPROVED or CLOSED status.
 */
@Service
@RequiredArgsConstructor
public class EvnInvoiceService {

    private final EvnInvoiceRepository evnInvoiceRepository;
    private final BillingPeriodRepository billingPeriodRepository;
    private final PeriodWriteGuard periodWriteGuard;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Returns all EVN invoices for the given billing period.
     *
     * @param periodId the billing period ID
     * @return list of EVN invoices
     */
    public List<EvnInvoice> findByPeriodId(Long periodId) {
        return evnInvoiceRepository.findAllByPeriodId(periodId);
    }

    /**
     * Finds an EVN invoice by ID.
     *
     * @param id the invoice ID
     * @return the EVN invoice
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if not found
     */
    public EvnInvoice findById(Long id) {
        return evnInvoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("EvnInvoice", id));
    }

    /**
     * Creates an EVN invoice for the specified period and updates the period's total kWh and amount.
     *
     * @param periodId  the billing period ID
     * @param request   invoice details (date, number, kWh, amount)
     * @param createdBy the user performing the action
     * @return the persisted invoice
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if the period is not found
     * @throws com.loc.electricity.application.exception.PeriodLockedException    if the period is APPROVED or CLOSED
     */
    @Transactional
    public EvnInvoice create(Long periodId, CreateEvnInvoiceRequest request, User createdBy) {
        BillingPeriod period = billingPeriodRepository.findById(periodId)
                .orElseThrow(() -> new ResourceNotFoundException("BillingPeriod", periodId));
        periodWriteGuard.assertWritable(period);

        EvnInvoice invoice = EvnInvoice.builder()
                .period(period)
                .invoiceDate(request.invoiceDate())
                .invoiceNumber(request.invoiceNumber())
                .kwh(request.kwh())
                .amount(request.amount())
                .attachmentUrl(request.attachmentUrl())
                .build();
        invoice = evnInvoiceRepository.save(invoice);

        syncPeriodTotals(period);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.CREATE_EVN_INVOICE,
                "EvnInvoice", invoice.getId(), null, invoice, createdBy));

        return invoice;
    }

    /**
     * Replaces all fields of an EVN invoice and re-syncs the period totals.
     *
     * @param id        the invoice ID
     * @param request   new invoice fields
     * @param updatedBy the user performing the action
     * @return the updated invoice
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if not found
     * @throws com.loc.electricity.application.exception.PeriodLockedException    if the period is APPROVED or CLOSED
     */
    @Transactional
    public EvnInvoice update(Long id, UpdateEvnInvoiceRequest request, User updatedBy) {
        EvnInvoice invoice = findById(id);
        BillingPeriod period = invoice.getPeriod();
        periodWriteGuard.assertWritable(period);

        EvnInvoice before = copyForAudit(invoice);

        invoice.setInvoiceDate(request.invoiceDate());
        invoice.setInvoiceNumber(request.invoiceNumber());
        invoice.setKwh(request.kwh());
        invoice.setAmount(request.amount());
        if (request.attachmentUrl() != null) {
            invoice.setAttachmentUrl(request.attachmentUrl());
        }
        invoice = evnInvoiceRepository.save(invoice);

        syncPeriodTotals(period);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.UPDATE_EVN_INVOICE,
                "EvnInvoice", invoice.getId(), before, invoice, updatedBy));

        return invoice;
    }

    /**
     * Deletes an EVN invoice and re-syncs the period totals.
     *
     * @param id        the invoice ID
     * @param deletedBy the user performing the action
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if not found
     * @throws com.loc.electricity.application.exception.PeriodLockedException    if the period is APPROVED or CLOSED
     */
    @Transactional
    public void delete(Long id, User deletedBy) {
        EvnInvoice invoice = findById(id);
        BillingPeriod period = invoice.getPeriod();
        periodWriteGuard.assertWritable(period);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.DELETE_EVN_INVOICE,
                "EvnInvoice", id, invoice, null, deletedBy));

        evnInvoiceRepository.delete(invoice);
        syncPeriodTotals(period);
    }

    private void syncPeriodTotals(BillingPeriod period) {
        period.setEvnTotalAmount(evnInvoiceRepository.sumAmountByPeriodId(period.getId()));
        period.setEvnTotalKwh(evnInvoiceRepository.sumKwhByPeriodId(period.getId()));
        billingPeriodRepository.save(period);
    }

    private EvnInvoice copyForAudit(EvnInvoice src) {
        EvnInvoice copy = new EvnInvoice();
        copy.setId(src.getId());
        copy.setInvoiceDate(src.getInvoiceDate());
        copy.setInvoiceNumber(src.getInvoiceNumber());
        copy.setKwh(src.getKwh());
        copy.setAmount(src.getAmount());
        return copy;
    }
}
