# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Electricity Billing System** — Spring Boot REST API that replaces a paper/Excel electricity billing process for ~100 households sharing one EVN master meter. See `ELECTRICITY_BILLING_SYSTEM_SPEC.md` for the full MVP specification (in Vietnamese).

Stack: Spring Boot 4.0.0 · Java 17 · MySQL 8 · H2 (tests) · Lombok · Spring Data JPA  
Frontend (separate repo, not here yet): React 19 + Tailwind

## Commands

```bash
# Run the application
./mvnw spring-boot:run

# Run all tests
./mvnw test

# Run a single test class
./mvnw test -Dtest=YourTestClassName

# Build without running tests
./mvnw package -DskipTests

# Compile only
./mvnw compile
```

## Configuration note

`src/main/resources/application.properties` still contains leftover values from a prior `ecommerece` project (datasource URL, app name). Update these before implementing any feature:

```properties
spring.application.name=electricity-billing-system
spring.datasource.url=jdbc:mysql://localhost:3306/electricity_billing
```

## Domain model

Eight core entities — defined in detail in `ELECTRICITY_BILLING_SYSTEM_SPEC.md` §4:

| Entity | Key points |
|---|---|
| `customer` | ~100 households; `active=false` soft-deletes from future periods |
| `billing_period` | A billing cycle; drives the central state machine (see below) |
| `evn_invoice` | Manual entry of EVN master meter bills; 1–N per period |
| `meter_reading` | UNIQUE(period_id, customer_id); `consumption` is a STORED generated column |
| `bill` | UNIQUE(period_id, customer_id); prices snapshotted at calculation time |
| `payment` | Incoming payments; `bill_id` may be NULL when bank transfer can't be matched |
| `system_setting` | Key-value config (default service price, bank account, overdue days) |
| `audit_log` | JSON before/after for every write on financial data |

## State machines

### `billing_period.status`

```
OPEN → READING_DONE → CALCULATED → APPROVED → CLOSED
                           ↑ revert (ADMIN, deletes all bills) ↓
```

- `OPEN→READING_DONE`: auto-triggered when all meter readings are submitted
- `CALCULATED→APPROVED`: locks the period; no entity (including ADMIN) may edit data afterward without an explicit revert
- Revert deletes all `bill` rows for the period and returns to `OPEN`

### `bill.status`

`PENDING → SENT → PAID` (or `PARTIAL` when partially paid, or `OVERDUE` after N days)

## Calculation formula

```
unit_price = (evn_total_amount + extra_fee) / total_consumption   [rounded to whole đồng]

For each bill:
  electricity_amount = consumption × unit_price
  service_amount     = consumption × service_unit_price
  total_amount       = electricity_amount + service_amount
```

Edge case: if `total_consumption = 0`, reject the calculation with a clear error. A customer with `consumption = 0` still gets a bill with `total_amount = 0`, status auto-set to `PAID`.

## Roles and authorization

| Role | Key permissions |
|---|---|
| `METER_READER` | Submit meter readings on OPEN periods only; no financial data access |
| `ACCOUNTANT` | Manage EVN invoices, trigger calculation; **cannot** approve |
| `ADMIN` | Full access; only role that can approve or revert a period |

After `APPROVED`, no writes are allowed on period data — enforced at service layer, not just via roles.

## SePay webhook

`POST /api/webhooks/sepay` (auth: `Apikey {SEPAY_WEBHOOK_SECRET}` header)

Handler must be `@Transactional` and follow this order:
1. Auth check
2. Skip if `transferType != "in"`
3. Idempotency: check `payment.bank_transaction_id` — return 200 immediately if already processed
4. Parse `payment_code` from content via regex: `TIENDIEN\s+(\S+)\s+(\S+)`
5. Look up bill by `payment_code`; save `Payment` with `bill_id=NULL` if unmatched
6. Update `bill.paid_amount` and status (`PARTIAL`/`PAID`)
7. **Always return** `HTTP 200 { "success": true }` — SePay retries on any other response

## PDF and QR generation

- **PDF**: OpenPDF (Apache 2.0) — A5 portrait, one page per bill
- **VietQR**: `img.vietqr.io` free API; TPBank BIN = `970423`; template = `compact2`
- **Print-pack**: `PdfCopy` merge of all period bills into one file for bulk printing
- Both are generated as a background job when a period transitions to `APPROVED`

## Package structure (to be built)

Base package: `com.loclt7.practice.electricitybilling`

Follow standard Spring layering: `entities`, `repositories`, `services`, `controllers`, `dtos`, `enums`, `configs`. Audit logging and the SePay webhook handler warrant their own sub-packages.