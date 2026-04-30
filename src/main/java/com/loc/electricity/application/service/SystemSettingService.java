package com.loc.electricity.application.service;

import com.loc.electricity.application.exception.ResourceNotFoundException;
import com.loc.electricity.domain.shared.SystemSetting;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SystemSettingService {

    private final SystemSettingRepository systemSettingRepository;

    public String getValue(String key) {
        return systemSettingRepository.findById(key)
                .map(SystemSetting::getSettingValue)
                .orElseThrow(() -> new ResourceNotFoundException("System setting not found: " + key));
    }

    public BigDecimal getDecimalValue(String key) {
        return new BigDecimal(getValue(key));
    }

    public int getIntValue(String key) {
        return Integer.parseInt(getValue(key));
    }

    public List<SystemSetting> findAll() {
        return systemSettingRepository.findAll();
    }

    @Transactional
    public SystemSetting update(String key, String value, User updatedBy) {
        SystemSetting setting = systemSettingRepository.findById(key)
                .orElseThrow(() -> new ResourceNotFoundException("System setting not found: " + key));
        setting.setSettingValue(value);
        setting.setUpdatedBy(updatedBy);
        return systemSettingRepository.save(setting);
    }
}
