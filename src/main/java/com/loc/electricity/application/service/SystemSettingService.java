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

/**
 * Provides access to system-wide key-value configuration stored in the {@code system_setting} table.
 * Settings are seeded by Flyway and updated via the admin UI.
 */
@Service
@RequiredArgsConstructor
public class SystemSettingService {

    private final SystemSettingRepository systemSettingRepository;

    /**
     * Returns the string value of a setting.
     *
     * @param key the setting key
     * @return the setting value
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if the key does not exist
     */
    public String getValue(String key) {
        return systemSettingRepository.findById(key)
                .map(SystemSetting::getSettingValue)
                .orElseThrow(() -> new ResourceNotFoundException("System setting not found: " + key));
    }

    /**
     * Returns the value of a setting parsed as a {@link java.math.BigDecimal}.
     *
     * @param key the setting key
     * @return the decimal value
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if the key does not exist
     * @throws NumberFormatException if the stored value is not a valid decimal
     */
    public BigDecimal getDecimalValue(String key) {
        return new BigDecimal(getValue(key));
    }

    /**
     * Returns the value of a setting parsed as an {@code int}.
     *
     * @param key the setting key
     * @return the integer value
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if the key does not exist
     * @throws NumberFormatException if the stored value is not a valid integer
     */
    public int getIntValue(String key) {
        return Integer.parseInt(getValue(key));
    }

    /**
     * Returns all system settings.
     *
     * @return list of all settings
     */
    public List<SystemSetting> findAll() {
        return systemSettingRepository.findAll();
    }

    /**
     * Updates the value of an existing setting.
     *
     * @param key       the setting key
     * @param value     the new value
     * @param updatedBy the user performing the update
     * @return the updated setting entity
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if the key does not exist
     */
    @Transactional
    public SystemSetting update(String key, String value, User updatedBy) {
        SystemSetting setting = systemSettingRepository.findById(key)
                .orElseThrow(() -> new ResourceNotFoundException("System setting not found: " + key));
        setting.setSettingValue(value);
        setting.setUpdatedBy(updatedBy);
        return systemSettingRepository.save(setting);
    }
}
