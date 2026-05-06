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

@Service
@RequiredArgsConstructor
public class EvnInvoiceService {

    private final EvnInvoiceRepository evnInvoiceRepository;
    private final BillingPeriodRepository billingPeriodRepository;
    private final PeriodWriteGuard periodWriteGuard;
    private final ApplicationEventPublisher eventPublisher;

    public List<EvnInvoice> findByPeriodId(Long periodId) {
        return evnInvoiceRepository.findAllByPeriodId(periodId);
    }

    public EvnInvoice findById(Long id) {
        return evnInvoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("EvnInvoice", id));
    }

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
