package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.request.UpdateSettingRequest;
import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.dto.response.SystemSettingResponse;
import com.loc.electricity.application.service.SystemSettingService;
import com.loc.electricity.domain.shared.SystemSetting;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.interfaces.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for managing system settings. Read access: ADMIN, ACCOUNTANT. Write: ADMIN only.
 */
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SystemSettingService systemSettingService;

    /**
     * {@code GET /api/settings} — Returns all system settings. Roles: ADMIN, ACCOUNTANT.
     *
     * @return list of all settings with their current values
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<SystemSettingResponse>>> list() {
        List<SystemSettingResponse> result = systemSettingService.findAll()
                .stream()
                .map(SystemSettingResponse::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /**
     * {@code PATCH /api/settings/{key}} — Updates a single system setting value. Role: ADMIN.
     *
     * @param key         the setting key (e.g. {@code default_service_fee}, {@code overdue_days})
     * @param request     contains the new value
     * @param currentUser the authenticated admin
     * @return the updated setting
     */
    @PatchMapping("/{key}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<SystemSettingResponse>> update(
            @PathVariable String key,
            @RequestBody UpdateSettingRequest request,
            @CurrentUser User currentUser) {
        SystemSetting updated = systemSettingService.update(key, request.value(), currentUser);
        return ResponseEntity.ok(ApiResponse.ok(SystemSettingResponse.from(updated)));
    }
}
