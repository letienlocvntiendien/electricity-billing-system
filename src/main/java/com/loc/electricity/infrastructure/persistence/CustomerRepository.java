package com.loc.electricity.infrastructure.persistence;

import com.loc.electricity.domain.customer.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    List<Customer> findAllByActiveTrue();

    Page<Customer> findAllByActive(boolean active, Pageable pageable);

    boolean existsByCode(String code);
}
