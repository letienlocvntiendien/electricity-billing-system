package com.loc.electricity.application.service;

import tools.jackson.databind.ObjectMapper;
import com.loc.electricity.domain.shared.AuditEvent;
import com.loc.electricity.domain.shared.AuditLog;
import com.loc.electricity.infrastructure.persistence.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuditEventListener {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onAuditEvent(AuditEvent event) {
        try {
            AuditLog auditLog = AuditLog.builder()
                    .user(event.getPerformedBy())
                    .action(event.getAction().name())
                    .entityType(event.getEntityType())
                    .entityId(event.getEntityId())
                    .beforeValue(toJson(event.getBeforeValue()))
                    .afterValue(toJson(event.getAfterValue()))
                    .ipAddress(extractIp())
                    .userAgent(extractUserAgent())
                    .build();

            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Failed to write audit log for action={} entity={} id={}",
                    event.getAction(), event.getEntityType(), event.getEntityId(), e);
        }
    }

    private String toJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return value.toString();
        }
    }

    private String extractIp() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest req = attrs.getRequest();
                String forwarded = req.getHeader("X-Forwarded-For");
                return forwarded != null ? forwarded.split(",")[0].trim() : req.getRemoteAddr();
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String extractUserAgent() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                return attrs.getRequest().getHeader("User-Agent");
            }
        } catch (Exception ignored) {}
        return null;
    }
}
