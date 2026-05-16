---
name: backend-logging
description: >
  Use this skill whenever logging is being added or modified in any backend Java service.
  Triggers on: adding @Slf4j, writing log.info/warn/error/debug calls, deciding what
  level to use, logging exceptions with stack traces, adding context identifiers to logs,
  understanding when to use AuditLog vs SLF4J. Load this skill before touching any
  logging code to stay consistent with the project's established conventions.
---

# Backend Logging — Project Skill

## Setup

Add `@Slf4j` from Lombok to the class — that's it. No manual `Logger` declaration.

```java
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class MyService {
    // log.info(...) is available immediately
}
```

---

## Log level quick reference

| Level | When to use | Example from this project |
|---|---|---|
| `INFO` | Business event succeeded (start, end, match) | `log.info("Bill generation for period {} complete — success={}, failed={}", periodId, success, failed)` |
| `WARN` | Recoverable edge case or unexpected-but-handled state | `log.warn("Bill {} ({}): customer has no phone number — skipping", bill.getId(), customerCode)` |
| `ERROR` | Operation failed; needs attention | `log.error("PDF generation failed for bill {} (customer {}): {}", bill.getId(), code, e.getMessage(), e)` |
| `DEBUG` | Technical detail useful during development only | `log.debug("Skipping non-inbound transfer type: {}", payload.getTransferType())` |

**Rule of thumb:** INFO for the happy path, WARN for "this is odd but we handled it", ERROR for "something broke and we couldn't recover", DEBUG for internals that aren't useful in production.

---

## Message format — always use `{}` placeholders

```java
// ✅ Correct — lazy evaluation, readable
log.info("Calculated bill for customer {} in period {}", customerId, periodId);

// ❌ Wrong — string concatenation evaluates even when log level is OFF
log.info("Calculated bill for customer " + customerId + " in period " + periodId);
```

---

## Exception logging — always pass `e` as the LAST argument

Passing the exception object as the final argument tells Logback to print the full stack trace. Passing only `e.getMessage()` drops the stack trace and makes debugging hard.

```java
// ✅ Full stack trace in log
log.error("PDF generation failed for bill {} (customer {}): {}",
        bill.getId(), bill.getCustomer().getCode(), e.getMessage(), e);

// ❌ No stack trace — impossible to diagnose
log.error("PDF generation failed: {}", e.getMessage());
```

From `BillGenerationService.java:98`:
```java
} catch (Exception e) {
    log.error("PDF generation failed for bill {} (customer {}): {}",
            bill.getId(), bill.getCustomer().getCode(), e.getMessage(), e);
    failed++;
}
```

---

## Context to always include

Log messages must carry enough identifiers to trace an operation without querying the database.

| Situation | Always include |
|---|---|
| Anything touching a Bill | `bill.getId()`, `bill.getCustomer().getCode()` |
| Anything touching a Period | `periodId` |
| Anything touching a Payment / webhook | `txnId` (bank transaction ID) |
| Anything touching a Customer | `customer.getCode()` (not just ID — the code is human-readable) |
| SMS / notification | `bill.getId()`, `customerCode`, `phone` |

---

## External integration pattern — arrow notation

For outbound requests and inbound responses to/from external systems (AWS SNS, SePay), use `→` for requests and `←` for responses. This makes log files visually scannable.

From `AwsSnsClient.java:50,65,68,71`:
```java
log.info("AWS SNS → Sending: phone={} e164={} contentLength={}", phone, e164Phone, content.length());

log.info("AWS SNS ← Success: messageId={}", response.messageId());

log.error("AWS SNS ← Error: code={} message={}", e.awsErrorDetails().errorCode(), e.getMessage());
log.error("AWS SNS ← Request failed for phone={}", phone, e);
```

From `SepayWebhookService.java:70,72`:
```java
log.info("SePay txn {} matched to bill {} ({})", txnId, matchedBill.getId(), matchedBill.getPaymentCode());
log.warn("SePay txn {} content '{}' did not match any bill — saved as unmatched", txnId, payload.getContent());
```

---

## AuditLog vs SLF4J — when to use each

These two systems serve different purposes and are NOT interchangeable:

| | **AuditLog** (database) | **SLF4J / Logback** (log files) |
|---|---|---|
| **Purpose** | Business accountability — who did what, before/after | Operational visibility — what is the system doing right now |
| **Audience** | Admins querying via the API (`GET /audit-logs`) | Developers / ops watching logs |
| **When triggered** | `applicationEventPublisher.publishEvent(new AuditEvent(...))` inside `@Transactional` | `log.info/warn/error/debug(...)` anywhere |
| **Persistence** | MySQL `audit_log` table — survives restarts | Log files / stdout — ephemeral |
| **Use for** | Login, CRUD on bills, approve/revert period, payments | Start/complete of batch jobs, skipped items, external API calls, errors |

**Rule:** Publish an `AuditEvent` for every financial write (already done in most services). Add SLF4J logs for operational context around that same operation — what was attempted, what succeeded, what was skipped.

`AuditEventListener.java` fires on `@TransactionalEventListener(phase = AFTER_COMMIT)`, so audit events only persist after the DB transaction commits. SLF4J logs write immediately.

---

## What NOT to log

- JWT tokens or any part of them
- Passwords or password hashes
- Full raw bank transfer content that may contain sensitive details — log only the matched payment code
- SMS message body at INFO in production (it's logged at INFO currently — acceptable for debugging, but be aware it contains amounts and payment codes)

---

## Logging configuration (profile-based)

`application-dev.properties`:
```properties
logging.level.com.loc.electricity.infrastructure.aws=DEBUG
logging.level.software.amazon.awssdk.request=DEBUG
```

`application-local.properties`:
```properties
logging.level.com.loc.electricity.infrastructure.aws=WARN
logging.level.software.amazon.awssdk=WARN
```

No `logback-spring.xml` exists — Spring Boot defaults apply (INFO for `com.loc.electricity`, WARN for third-party libraries).

---

## Services currently missing SLF4J logging

These services publish `AuditEvent` to the database but have no SLF4J logs, which means failures are silent in the log stream:

| Service | Methods worth logging |
|---|---|
| `AuthService` | Login attempts (success + failure), logout |
| `PeriodService` | calculate, verify, approve, revert, close — each should log start + completion with period ID |
| `BillService` | markSent, payment assignment |

When adding logs to these, follow the same pattern as `BillGenerationService`: `INFO` at start of operation with the key identifier, `INFO` at completion with outcome summary, `ERROR` in the catch block with full exception.

---

## Reference — well-logged services to copy from

- `BillGenerationService.java:51,98–104` — start/complete INFO + ERROR with full stack trace
- `SmsNotificationService.java:57,64,83,90` — WARN for skipped items, INFO for content preview and success
- `AwsSnsClient.java:45,50,65,68,71` — initialization INFO + arrow-style request/response
- `SepayWebhookService.java:39,45,70,72,98` — DEBUG for filtered items, INFO for matches, WARN for unmatched
- `SepayWebhookAuthFilter.java:39` — WARN for auth failures with IP address