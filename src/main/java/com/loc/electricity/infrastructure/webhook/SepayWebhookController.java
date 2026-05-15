package com.loc.electricity.infrastructure.webhook;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Handles SePay bank transfer notifications.
 *
 * Auth is enforced by SepayWebhookAuthFilter (Apikey header).
 * This controller MUST always return HTTP 200 — SePay retries on any other status.
 * It is intentionally NOT in interfaces/web/ so the GlobalExceptionHandler does not intercept it.
 */
@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
@Slf4j
public class SepayWebhookController {

    private final SepayWebhookService sepayWebhookService;

    /**
     * {@code POST /api/webhooks/sepay} — Receives a bank transfer notification from SePay.
     * Always returns HTTP 200 to prevent SePay from retrying; auth is enforced by
     * {@link SepayWebhookAuthFilter} via the {@code Apikey} header.
     *
     * @param payload the SePay notification payload
     * @return {@code {"success": true}}
     */
    @PostMapping("/sepay")
    public ResponseEntity<Map<String, Boolean>> handleSepay(@RequestBody SepayWebhookPayload payload) {
        sepayWebhookService.handleWebhook(payload);
        return ResponseEntity.ok(Map.of("success", true));
    }

    /**
     * Catches any unhandled exception during webhook processing and returns HTTP 200.
     * This prevents SePay from retrying on processing errors; the error is logged for investigation.
     *
     * @param e the exception that occurred
     * @return {@code {"success": true}}
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Boolean>> handleError(Exception e) {
        log.error("SePay webhook processing error", e);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
