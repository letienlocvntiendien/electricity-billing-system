package com.loc.electricity.application.service;

import com.loc.electricity.application.dto.request.AssignPaymentRequest;
import com.loc.electricity.application.dto.request.CreatePaymentRequest;
import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.application.exception.ResourceNotFoundException;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.payment.Payment;
import com.loc.electricity.domain.shared.AuditAction;
import com.loc.electricity.domain.shared.AuditEvent;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.persistence.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final BillRepository billRepository;
    private final ApplicationEventPublisher eventPublisher;

    public Page<Payment> findUnmatched(Pageable pageable) {
        return paymentRepository.findByBillIdIsNull(pageable);
    }

    public Payment findById(Long id) {
        return paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", id));
    }

    @Transactional
    public Payment createManualPayment(Long billId, CreatePaymentRequest request, User recordedBy) {
        Bill bill = billRepository.findById(billId)
                .orElseThrow(() -> new ResourceNotFoundException("Bill", billId));

        if (bill.getStatus() == BillStatus.PAID) {
            throw new BusinessException("BILL_ALREADY_PAID",
                    "Bill is already fully paid", HttpStatus.UNPROCESSABLE_ENTITY);
        }

        Payment payment = Payment.builder()
                .bill(bill)
                .amount(request.amount())
                .method(request.method())
                .paidAt(request.paidAt())
                .notes(request.notes())
                .recordedBy(recordedBy)
                .build();
        payment = paymentRepository.save(payment);

        updateBillPaidAmount(bill);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.CREATE_PAYMENT,
                "Payment", payment.getId(), null, payment, recordedBy));

        return payment;
    }

    @Transactional
    public Payment assignPayment(Long paymentId, AssignPaymentRequest request, User assignedBy) {
        Payment payment = findById(paymentId);

        if (payment.getBill() != null) {
            throw new BusinessException("PAYMENT_ALREADY_ASSIGNED",
                    "Payment is already assigned to bill " + payment.getBill().getId(),
                    HttpStatus.CONFLICT);
        }

        Bill bill = billRepository.findById(request.billId())
                .orElseThrow(() -> new ResourceNotFoundException("Bill", request.billId()));

        if (bill.getStatus() == BillStatus.PAID) {
            throw new BusinessException("BILL_ALREADY_PAID",
                    "Cannot assign payment — bill is already fully paid",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        payment.setBill(bill);
        payment = paymentRepository.save(payment);

        updateBillPaidAmount(bill);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.ASSIGN_PAYMENT,
                "Payment", paymentId, null, payment, assignedBy));

        return payment;
    }

    private void updateBillPaidAmount(Bill bill) {
        BigDecimal totalPaid = paymentRepository.sumAmountByBillId(bill.getId());
        bill.setPaidAmount(totalPaid);
        bill.setStatus(totalPaid.compareTo(bill.getTotalAmount()) >= 0
                ? BillStatus.PAID
                : (totalPaid.compareTo(BigDecimal.ZERO) > 0 ? BillStatus.PARTIAL : bill.getStatus()));
        billRepository.save(bill);
    }
}
