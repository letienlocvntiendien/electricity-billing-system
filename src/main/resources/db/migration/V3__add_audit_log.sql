-- Adds audit_log table if it was missing from an earlier V1 application.
CREATE TABLE IF NOT EXISTS audit_log (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    user_id       BIGINT,
    action        VARCHAR(50)  NOT NULL,
    entity_type   VARCHAR(50)  NOT NULL,
    entity_id     BIGINT,
    before_value  JSON,
    after_value   JSON,
    ip_address    VARCHAR(45),
    user_agent    VARCHAR(500),
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_entity  (entity_type, entity_id),
    KEY idx_audit_user    (user_id),
    KEY idx_audit_created (created_at),
    KEY idx_audit_action  (action),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES `user` (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
