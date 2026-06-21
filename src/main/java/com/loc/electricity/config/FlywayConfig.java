package com.loc.electricity.config;

import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * Spring Boot 4.0 removed Flyway auto-configuration — must configure manually.
 * Runs data migrations after Hibernate initializes the schema (ddl-auto=update).
 * Schema is owned by Hibernate; Flyway handles data-only migrations (V10+).
 */
@Slf4j
@Component
@Profile("prod")
@Order(1)
public class FlywayConfig implements ApplicationRunner {

    private final DataSource dataSource;

    public FlywayConfig(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info("[Flyway] Starting manual migration...");
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("9")
                .load();
        var result = flyway.migrate();
        log.info("[Flyway] Migration complete — {} migration(s) applied.", result.migrationsExecuted);
    }
}
