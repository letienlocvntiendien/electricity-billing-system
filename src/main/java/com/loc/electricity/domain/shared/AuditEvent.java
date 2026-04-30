package com.loc.electricity.domain.shared;

import com.loc.electricity.domain.user.User;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class AuditEvent extends ApplicationEvent {

    private final AuditAction action;
    private final String entityType;
    private final Long entityId;
    private final Object beforeValue;
    private final Object afterValue;
    private final User performedBy;

    public AuditEvent(Object source, AuditAction action, String entityType, Long entityId,
                      Object beforeValue, Object afterValue, User performedBy) {
        super(source);
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
        this.beforeValue = beforeValue;
        this.afterValue = afterValue;
        this.performedBy = performedBy;
    }
}
