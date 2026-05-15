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

/**
 * REST controller for customer management. Requires ADMIN, ACCOUNTANT, or METER_READER role
 * depending on the operation. Write operations (create/update/delete) are ADMIN-only.
 */
@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    /**
     * {@code GET /api/customers} — Returns a paginated list of customers.
     * Optionally filters by active status. Roles: ADMIN, ACCOUNTANT, METER_READER.
     *
     * @param active   filter by active status; omit to return all
     * @param pageable pagination and sorting (default: size=50, sort=code)
     * @return page of customer summaries
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT','METER_READER')")
    public ResponseEntity<ApiResponse<Page<CustomerResponse>>> list(
            @RequestParam(required = false) Boolean active,
            @PageableDefault(size = 50, sort = "code") Pageable pageable) {
        Page<CustomerResponse> page = customerService.findAll(active, pageable)
                .map(CustomerResponse::from);
        return ResponseEntity.ok(ApiResponse.ok(page));
    }

    /**
     * {@code GET /api/customers/{id}} — Returns a single customer. Roles: ADMIN, ACCOUNTANT.
     *
     * @param id the customer ID
     * @return the customer
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<CustomerResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(CustomerResponse.from(customerService.findById(id))));
    }

    /**
     * {@code POST /api/customers} — Creates a new customer. Role: ADMIN.
     * Seeds a meter reading slot if a period is currently OPEN.
     *
     * @param request     customer fields
     * @param currentUser the authenticated admin
     * @return the created customer with HTTP 201
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomerResponse>> create(
            @Valid @RequestBody CreateCustomerRequest request,
            @CurrentUser User currentUser) {
        CustomerResponse response = CustomerResponse.from(customerService.create(request, currentUser));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    /**
     * {@code PATCH /api/customers/{id}} — Partially updates a customer. Role: ADMIN.
     *
     * @param id          the customer ID
     * @param request     fields to update (null fields are ignored)
     * @param currentUser the authenticated admin
     * @return the updated customer
     */
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomerResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCustomerRequest request,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(CustomerResponse.from(
                customerService.update(id, request, currentUser))));
    }

    /**
     * {@code DELETE /api/customers/{id}} — Soft-deletes a customer (sets active=false). Role: ADMIN.
     *
     * @param id          the customer ID
     * @param currentUser the authenticated admin
     * @return empty 200 response
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        customerService.softDelete(id, currentUser);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
