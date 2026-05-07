# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.
For a full current-state summary see `docs/PROJECT_CONTEXT.md`.

## Project overview

**Electricity Billing System** — Spring Boot REST API + React frontend replacing a
paper/Excel billing process for ~100 households sharing one EVN master meter.

Stack: Spring Boot 4.0 · Java 17 · MySQL 8 · H2 (tests) · Lombok · Spring Data JPA  
Frontend: React 19 + TypeScript + Tailwind (in `frontend/` subdirectory)  
Base package: `com.loc.electricity`

## Commands

```bash
# Backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev   # with seed data
./mvnw compile          # compile only
./mvnw test             # run all tests
./mvnw package -DskipTests

# Frontend
cd frontend && npm install && npm run dev
```

## Domain entities

| Entity | Key points |
|---|---|
| `customer` | ~100 households; `active=false` soft-deletes from future periods |
| `billing_period` | Drives the central state machine; owns `approvedBy`/`accountantVerifiedBy` (EAGER) |
| `evn_invoice` | Manual entry of EVN master meter bills; simple `kwh + amount` (V5 reverted TOU) |
| `meter_reading` | UNIQUE(period_id, customer_id); `consumption` is a **STORED GENERATED COLUMN** — never set it in Java |
| `bill` | UNIQUE(period_id, customer_id); prices snapshotted at calculation time |
| `payment` | `bill_id` may be NULL for unmatched bank transfers |
| `system_setting` | Key-value config; seeded by Flyway V1 |
| `audit_log` | JSON before/after for every financial write |

## State machine — `billing_period.status`

```
OPEN → READING_DONE → CALCULATED → APPROVED → CLOSED
              ↑  revert from CALCULATED or APPROVED (deletes bills, clears verify/approve) ↓
```

Transitions:
- `OPEN → READING_DONE` : **explicit** `POST /periods/{id}/submit-readings` (METER_READER only)
- `READING_DONE → CALCULATED` : `POST /periods/{id}/calculate` (ACCOUNTANT/ADMIN) — requires ≥1 EVN invoice
- `CALCULATED → CALCULATED` : `POST /periods/{id}/verify` (ACCOUNTANT/ADMIN) — sets `accountantVerifiedAt`
- `CALCULATED → APPROVED` : `POST /periods/{id}/approve` (ADMIN) — requires `accountantVerifiedAt != null`
- `APPROVED → CLOSED` : `POST /periods/{id}/close` (ADMIN)
- `CALCULATED|APPROVED → OPEN` : `POST /periods/{id}/revert` (ADMIN) — deletes all bills, clears verified/approved fields

`PeriodWriteGuard.assertWritable()` blocks edits when `APPROVED` or `CLOSED`.

## Calculation formula (Spec V2 — current)

```
unit_price = (evn_total_amount + extra_fee) / total_consumption
             [DECIMAL(10,2), RoundingMode.HALF_UP]

For each bill:
  electricity_amount = unit_price × consumption       [rounded to 0 decimal, HALF_UP]
  service_amount     = service_fee                    [FLAT per household, NOT × consumption]
  total_amount       = electricity_amount + service_amount

Edge cases:
  total_consumption = 0  → throw ZERO_CONSUMPTION error
  individual consumption = 0  → bill total = service_fee, status = PAID if service_fee = 0
```

**Key change from Spec V1:** `service_fee` is a flat fee per household (not per-kWh).

## Roles and authorization

| Role | Key permissions |
|---|---|
| `METER_READER` | Submit individual readings + `submit-readings` to close readings phase |
| `ACCOUNTANT` | Manage EVN invoices, calculate, verify, record payments |
| `ADMIN` | Full access; only role that can approve, revert, or close a period |

## Security (simplified)

- Stateless JWT — 8-hour access tokens, no refresh tokens
- Login: `POST /api/auth/login` → `{ accessToken, tokenType, username, fullName, role }`
- Logout: `POST /api/auth/logout` (no-op, token expires naturally)
- `refresh_token` table exists in DB but is unused — kept to avoid a migration

## Important gotchas

1. `meter_reading.consumption` is `@Column(insertable=false, updatable=false)` — DB generates it.
   Only set `previousIndex` and `currentIndex` in the builder.
2. `BillingPeriod.approvedBy` and `.accountantVerifiedBy` are `FetchType.EAGER` —
   changed from LAZY to fix `LazyInitializationException` in `PeriodResponse.from()`.
3. `DataInitializer` runs only with `--spring.profiles.active=dev` AND when `admin` user doesn't exist.
4. `OverdueScheduler` has `@Profile("!dev")` — does not run in dev profile.
5. Do NOT call service-layer methods from `DataInitializer` — they fire audit events and enforce state machine rules. Save directly via repositories.

## SePay webhook

`POST /api/webhooks/sepay` (auth: `Apikey {SEPAY_WEBHOOK_SECRET}` header)  
Always return HTTP 200 — SePay retries on any other response.  
Parse payment code via regex: `TIENDIEN\s+(\S+)\s+(\S+)`

## Custom commands available

| Command | Purpose |
|---|---|
| `/project:verify-billing` | Verify billing calculation correctness with test numbers |
| `/project:add-feature` | Architecture guide for adding new backend + frontend features |
| `/project:jpa-patterns` | JPA gotchas and patterns specific to this project |
