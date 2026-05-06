package com.loc.electricity.application.dto.response;

import com.loc.electricity.domain.shared.SystemSetting;

public record SystemSettingResponse(
        String settingKey,
        String settingValue,
        String description
) {
    public static SystemSettingResponse from(SystemSetting s) {
        return new SystemSettingResponse(s.getSettingKey(), s.getSettingValue(), s.getDescription());
    }
}
