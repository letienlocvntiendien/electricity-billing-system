package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.request.CreateCustomerRequest;
import com.loc.electricity.application.dto.request.UpdateCustomerRequest;
import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.dto.response.CustomerResponse;
import com.loc.electricity.application.service.CustomerService;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.interfaces.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT','METER_READER')")
    public ResponseEntity<ApiResponse<Page<CustomerResponse>>> list(
            @RequestParam(required = false) Boolean active,
            @PageableDefault(size = 50, sort = "code") Pageable pageable) {
        Page<CustomerResponse> page = customerService.findAll(active, pageable)
                .map(CustomerResponse::from);
        return ResponseEntity.ok(ApiResponse.ok(page));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<CustomerResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(CustomerResponse.from(customerService.findById(id))));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomerResponse>> create(
            @Valid @RequestBody CreateCustomerRequest request,
            @CurrentUser User currentUser) {
        CustomerResponse response = CustomerResponse.from(customerService.create(request, currentUser));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomerResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCustomerRequest request,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(CustomerResponse.from(
                customerService.update(id, request, currentUser))));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        customerService.softDelete(id, currentUser);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
