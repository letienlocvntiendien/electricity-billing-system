package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.service.SystemSettingService;
import com.loc.electricity.domain.shared.SystemSetting;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.interfaces.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SystemSettingService systemSettingService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<SystemSetting>>> list() {
        return ResponseEntity.ok(ApiResponse.ok(systemSettingService.findAll()));
    }

    @PatchMapping("/{key}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<SystemSetting>> update(
            @PathVariable String key,
            @RequestBody Map<String, String> body,
            @CurrentUser User currentUser) {
        String value = body.get("value");
        SystemSetting updated = systemSettingService.update(key, value, currentUser);
        return ResponseEntity.ok(ApiResponse.ok(updated));
    }
}
