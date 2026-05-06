package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.request.UpdateSettingRequest;
import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.dto.response.SystemSettingResponse;
import com.loc.electricity.application.service.SystemSettingService;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.interfaces.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SystemSettingService systemSettingService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<SystemSettingResponse>>> list() {
        List<SystemSettingResponse> result = systemSettingService.findAll()
                .stream()
                .map(SystemSettingResponse::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PatchMapping("/{key}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<SystemSettingResponse>> update(
            @PathVariable String key,
            @RequestBody UpdateSettingRequest request,
            @CurrentUser User currentUser) {
        var updated = systemSettingService.update(key, request.value(), currentUser);
        return ResponseEntity.ok(ApiResponse.ok(SystemSettingResponse.from(updated)));
    }
}
