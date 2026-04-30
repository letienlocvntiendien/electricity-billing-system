package com.loc.electricity.infrastructure.persistence;

import com.loc.electricity.domain.shared.SystemSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemSettingRepository extends JpaRepository<SystemSetting, String> {
}
