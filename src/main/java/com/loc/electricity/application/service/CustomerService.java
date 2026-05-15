package com.loc.electricity.application.service;

import com.loc.electricity.application.dto.request.CreateCustomerRequest;
import com.loc.electricity.application.dto.request.UpdateCustomerRequest;
import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.application.exception.ResourceNotFoundException;
import com.loc.electricity.domain.customer.Customer;
import com.loc.electricity.domain.period.PeriodStatus;
import com.loc.electricity.domain.reading.MeterReading;
import com.loc.electricity.domain.shared.AuditAction;
import com.loc.electricity.domain.shared.AuditEvent;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.BillingPeriodRepository;
import com.loc.electricity.infrastructure.persistence.CustomerRepository;
import com.loc.electricity.infrastructure.persistence.MeterReadingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Manages customer CRUD operations, including soft-delete and automatic meter reading slot
 * synchronization with the currently active billing period.
 */
@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final BillingPeriodRepository billingPeriodRepository;
    private final MeterReadingRepository meterReadingRepository;

    /**
     * Returns a paginated list of customers, optionally filtered by active status.
     *
     * @param active   {@code true} for active only, {@code false} for inactive only, {@code null} for all
     * @param pageable pagination and sorting parameters
     * @return page of matching customers
     */
    public Page<Customer> findAll(Boolean active, Pageable pageable) {
        if (active != null) {
            return customerRepository.findAllByActive(active, pageable);
        }
        return customerRepository.findAll(pageable);
    }

    /**
     * Finds a customer by ID.
     *
     * @param id the customer ID
     * @return the customer
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if not found
     */
    public Customer findById(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", id));
    }

    /**
     * Creates a new customer. If a billing period is currently OPEN, a meter reading slot
     * is automatically seeded for this customer using their latest submitted reading as the starting index.
     *
     * @param request   customer details
     * @param createdBy the user performing the action
     * @return the persisted customer
     * @throws com.loc.electricity.application.exception.BusinessException if the customer code already exists
     */
    @Transactional
    public Customer create(CreateCustomerRequest request, User createdBy) {
        if (customerRepository.existsByCode(request.code())) {
            throw new BusinessException("DUPLICATE_CODE",
                    "Customer code already exists: " + request.code());
        }

        Customer customer = Customer.builder()
                .code(request.code())
                .fullName(request.fullName())
                .phone(request.phone())
                .zaloPhone(request.zaloPhone())
                .meterSerial(request.meterSerial())
                .notes(request.notes())
                .active(true)
                .build();

        customer = customerRepository.save(customer);
        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.CREATE_CUSTOMER,
                "Customer", customer.getId(), null, customer, createdBy));

        addReadingToOpenPeriod(customer);
        return customer;
    }

    /**
     * Updates customer fields. Partial update — only non-null fields in the request are applied.
     * Re-activating a customer seeds a meter reading slot in the current OPEN period;
     * deactivating removes any unsubmitted reading slot.
     *
     * @param id        the customer ID
     * @param request   fields to update (null fields are ignored)
     * @param updatedBy the user performing the action
     * @return the updated customer
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if not found
     */
    @Transactional
    public Customer update(Long id, UpdateCustomerRequest request, User updatedBy) {
        Customer customer = findById(id);
        Customer before = copyOf(customer);

        boolean wasActive = customer.isActive();

        if (request.fullName() != null) customer.setFullName(request.fullName());
        if (request.phone() != null) customer.setPhone(request.phone());
        if (request.zaloPhone() != null) customer.setZaloPhone(request.zaloPhone());
        if (request.meterSerial() != null) customer.setMeterSerial(request.meterSerial());
        if (request.notes() != null) customer.setNotes(request.notes());
        if (request.active() != null) customer.setActive(request.active());

        customer = customerRepository.save(customer);
        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.UPDATE_CUSTOMER,
                "Customer", customer.getId(), before, customer, updatedBy));

        if (!wasActive && Boolean.TRUE.equals(request.active())) {
            addReadingToOpenPeriod(customer);
        } else if (wasActive && Boolean.FALSE.equals(request.active())) {
            removeUnsubmittedReadingFromOpenPeriod(customer);
        }

        return customer;
    }

    /**
     * Soft-deletes a customer by setting {@code active = false}. Any unsubmitted meter reading
     * slot in the current OPEN period is removed; submitted readings are preserved.
     *
     * @param id        the customer ID
     * @param deletedBy the user performing the action
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if not found
     */
    @Transactional
    public void softDelete(Long id, User deletedBy) {
        Customer customer = findById(id);
        Customer before = copyOf(customer);
        customer.setActive(false);
        customerRepository.save(customer);
        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.DELETE_CUSTOMER,
                "Customer", id, before, customer, deletedBy));

        removeUnsubmittedReadingFromOpenPeriod(customer);
    }

    /**
     * Returns all active customers, ordered by the repository default (code ascending).
     *
     * @return list of active customers
     */
    public List<Customer> findAllActive() {
        return customerRepository.findAllByActiveTrue();
    }

    // Tạo MeterReading cho kỳ OPEN nếu chưa có (dùng khi thêm mới hoặc reactivate)
    private void addReadingToOpenPeriod(Customer customer) {
        billingPeriodRepository
                .findFirstByStatusInOrderByStartDateDesc(List.of(PeriodStatus.OPEN))
                .ifPresent(openPeriod -> {
                    if (meterReadingRepository
                            .findByPeriodIdAndCustomerId(openPeriod.getId(), customer.getId())
                            .isPresent()) return;

                    int previousIndex = meterReadingRepository
                            .findLatestSubmittedByCustomerId(customer.getId())
                            .map(MeterReading::getCurrentIndex)
                            .orElse(0);

                    meterReadingRepository.save(MeterReading.builder()
                            .period(openPeriod)
                            .customer(customer)
                            .previousIndex(previousIndex)
                            .currentIndex(previousIndex)
                            .build());
                });
    }

    // Xóa MeterReading chưa submit của kỳ OPEN (dùng khi deactivate)
    // Reading đã submit (readAt != null) được giữ nguyên để bảo toàn dữ liệu
    private void removeUnsubmittedReadingFromOpenPeriod(Customer customer) {
        billingPeriodRepository
                .findFirstByStatusInOrderByStartDateDesc(List.of(PeriodStatus.OPEN))
                .ifPresent(openPeriod ->
                        meterReadingRepository
                                .findByPeriodIdAndCustomerId(openPeriod.getId(), customer.getId())
                                .ifPresent(reading -> {
                                    if (reading.getReadAt() == null) {
                                        meterReadingRepository.delete(reading);
                                    }
                                })
                );
    }

    private Customer copyOf(Customer c) {
        return Customer.builder()
                .id(c.getId()).code(c.getCode()).fullName(c.getFullName())
                .phone(c.getPhone()).zaloPhone(c.getZaloPhone())
                .meterSerial(c.getMeterSerial()).notes(c.getNotes())
                .active(c.isActive()).build();
    }
}
