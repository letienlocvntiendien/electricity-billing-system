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
import java.util.List;

/**
 * Manages payment creation, assignment to bills, and queries.
 * Supports both manual (staff-recorded) payments and assignment of unmatched bank transfers.
 */
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final BillRepository billRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Returns a paginated list of bank transfer payments that have not yet been matched to a bill.
     *
     * @param pageable pagination and sorting parameters
     * @return page of unmatched payments
     */
    public Page<Payment> findUnmatched(Pageable pageable) {
        return paymentRepository.findByBillIdIsNull(pageable);
    }

    /**
     * Returns all payments for the given bill, ordered by payment date descending.
     *
     * @param billId the bill ID
     * @return list of payments
     */
    public List<Payment> findByBillId(Long billId) {
        return paymentRepository.findByBillIdOrderByPaidAtDesc(billId);
    }

    /**
     * Finds a payment by ID.
     *
     * @param id the payment ID
     * @return the payment
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if not found
     */
    public Payment findById(Long id) {
        return paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", id));
    }

    /**
     * Records a manual payment against a bill and recalculates the bill's paid amount and status.
     *
     * @param billId     the target bill ID
     * @param request    payment details (amount, method, paidAt, notes)
     * @param recordedBy the user recording the payment
     * @return the persisted payment
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if the bill is not found
     * @throws com.loc.electricity.application.exception.BusinessException         if the bill is already fully paid
     */
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

    /**
     * Links an unmatched payment to the specified bill, then recalculates the bill's paid amount and status.
     *
     * @param paymentId  the unmatched payment ID
     * @param request    contains the target bill ID
     * @param assignedBy the user performing the assignment
     * @return the updated payment
     * @throws com.loc.electricity.application.exception.BusinessException if the payment is already assigned
     *                                                                     or the target bill is already fully paid
     */
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
