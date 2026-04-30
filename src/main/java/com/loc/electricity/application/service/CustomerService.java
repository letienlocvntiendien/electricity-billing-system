package com.loc.electricity.application.service;

import com.loc.electricity.application.dto.request.CreateCustomerRequest;
import com.loc.electricity.application.dto.request.UpdateCustomerRequest;
import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.application.exception.ResourceNotFoundException;
import com.loc.electricity.domain.customer.Customer;
import com.loc.electricity.domain.shared.AuditAction;
import com.loc.electricity.domain.shared.AuditEvent;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.CustomerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final ApplicationEventPublisher eventPublisher;

    public Page<Customer> findAll(Boolean active, Pageable pageable) {
        if (active != null) {
            return customerRepository.findAllByActive(active, pageable);
        }
        return customerRepository.findAll(pageable);
    }

    public Customer findById(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", id));
    }

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
        return customer;
    }

    @Transactional
    public Customer update(Long id, UpdateCustomerRequest request, User updatedBy) {
        Customer customer = findById(id);
        Customer before = copyOf(customer);

        if (request.fullName() != null) customer.setFullName(request.fullName());
        if (request.phone() != null) customer.setPhone(request.phone());
        if (request.zaloPhone() != null) customer.setZaloPhone(request.zaloPhone());
        if (request.meterSerial() != null) customer.setMeterSerial(request.meterSerial());
        if (request.notes() != null) customer.setNotes(request.notes());
        if (request.active() != null) customer.setActive(request.active());

        customer = customerRepository.save(customer);
        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.UPDATE_CUSTOMER,
                "Customer", customer.getId(), before, customer, updatedBy));
        return customer;
    }

    @Transactional
    public void softDelete(Long id, User deletedBy) {
        Customer customer = findById(id);
        Customer before = copyOf(customer);
        customer.setActive(false);
        customerRepository.save(customer);
        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.DELETE_CUSTOMER,
                "Customer", id, before, customer, deletedBy));
    }

    public List<Customer> findAllActive() {
        return customerRepository.findAllByActiveTrue();
    }

    private Customer copyOf(Customer c) {
        return Customer.builder()
                .id(c.getId()).code(c.getCode()).fullName(c.getFullName())
                .phone(c.getPhone()).zaloPhone(c.getZaloPhone())
                .meterSerial(c.getMeterSerial()).notes(c.getNotes())
                .active(c.isActive()).build();
    }
}
