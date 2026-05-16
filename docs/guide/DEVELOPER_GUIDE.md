# Electricity Billing System — Developer Guide

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Running the Application](#2-running-the-application)
3. [Seed Credentials (Dev Profile)](#3-seed-credentials-dev-profile)
4. [Project Structure](#4-project-structure)
5. [User Roles & Permissions](#5-user-roles--permissions)
6. [State Machines](#6-state-machines)
7. [API Reference](#7-api-reference)
8. [Frontend Routes](#8-frontend-routes)
9. [Configuration Reference](#9-configuration-reference)
10. [Common Workflows](#10-common-workflows)
11. [Developer Notes](#11-developer-notes)

---

## 1. Tech Stack

### Backend
| Component | Version |
|---|---|
| Java | 17 |
| Spring Boot | 4.0.0 |
| MySQL | 8.x |
| H2 (tests / dev) | included |
| Flyway | included in Boot |
| JJWT | 0.12.6 |
| OpenPDF | 2.0.3 |
| Lombok | included |

### Frontend
| Component | Version |
|---|---|
| React | 19.2.5 |
| TypeScript | ~6.0 |
| Vite | 8.0.10 |
| Tailwind CSS | 3.4.19 |
| React Router | 6.30.3 |
| Axios | 1.15.2 |
| Radix UI | 1.x |

---

## 2. Running the Application

### Backend

**With MySQL (production-like):**
```bash
./mvnw spring-boot:run
```
- Requires MySQL at `localhost:3306/electricity_billing`
- Default credentials: `root` / `123456` (override via env vars)
- Access token TTL: 15 minutes

**With dev profile (H2 in-memory + auto-seed):**
```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```
- Uses H2 in-memory database — no MySQL required
- Auto-seeds 3 users, 10 customers, 3 periods on first startup
- Access token TTL: 1 hour (Postman-friendly)
- `OverdueScheduler` is disabled so seeded bill statuses stay frozen
- Verify seed: log line `[DataInitializer] Dev seed complete.`
- Verify idempotent restart: log line `[DataInitializer] Seed data already present — skipping.`

**Environment variable overrides:**
| Variable | Default | Purpose |
|---|---|---|
| `DB_USERNAME` | `root` | MySQL username |
| `DB_PASSWORD` | `123456` | MySQL password |
| `JWT_SECRET` | (dev key) | Base64-encoded 64-char secret |
| `SEPAY_WEBHOOK_SECRET` | `dev-secret` | SePay webhook signing key |
| `UPLOAD_DIR` | `uploads` | Directory for PDFs and files |

### Frontend
```bash
cd frontend
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview production build
```

The Vite dev server proxies `/api` requests to `http://localhost:8080`.

---

## 3. Seed Credentials (Dev Profile)

### Users
| Username | Password | Role | Full Name |
|---|---|---|---|
| `admin` | `Admin@123` | ADMIN | Quản trị viên |
| `accountant` | `Account@123` | ACCOUNTANT | Kế toán Nguyễn Thị Hoa |
| `reader` | `Reader@123` | METER_READER | Thợ đọc đồng hồ Trần Văn Minh |

### Seeded Data Overview
- **10 customers**: KH001–KH010 with meter serials DK-001-A through DK-010-K. KH007 has no Zalo phone (tests missing-Zalo edge case).
- **System settings**: `bank_account_number = 00012345678910`, `bank_account_holder = NGUYEN VAN AN`

### Seeded Billing Periods

| Period | Code | Status | EVN kWh | Unit Price | Bill States |
|---|---|---|---|---|---|
| Kỳ tháng 02/2025 | `2025-02` | CLOSED | 4,819 | 1,566 đ/kWh | 5 PAID · 3 PARTIAL · 2 OVERDUE |
| Kỳ tháng 03/2025 | `2025-03` | APPROVED | 5,100 | 1,588 đ/kWh | 3 PAID · 4 PENDING · 2 PARTIAL · 1 SENT |
| Kỳ tháng 04/2025 | `2025-04` | OPEN | — | — | No bills yet; 6/10 readings submitted |

Period 2 also has **1 unmatched payment** (`bill_id = null`, 500,000 VND, `TXN-UNMATCHED-202503`) to test the payment assignment flow.

---

## 4. Project Structure

```
electricity-billing-system/
├── src/main/java/com/loc/electricity/
│   ├── config/                        # Spring beans, DataInitializer, Security
│   ├── domain/                        # Entities + enums grouped by domain
│   │   ├── user/                      # User, RefreshToken, Role
│   │   ├── customer/                  # Customer
│   │   ├── period/                    # BillingPeriod, EvnInvoice, PeriodStatus
│   │   ├── reading/                   # MeterReading
│   │   ├── bill/                      # Bill, BillStatus
│   │   ├── payment/                   # Payment, PaymentMethod
│   │   └── shared/                    # SystemSetting, AuditLog, events
│   ├── infrastructure/
│   │   ├── persistence/               # Spring Data JPA repositories
│   │   ├── pdf/                       # PdfGenerationService, PrintPackService
│   │   ├── storage/                   # LocalFileStorageService
│   │   ├── webhook/                   # SePay webhook handler
│   │   ├── qr/                        # VietQR service
│   │   └── zalo/                      # Zalo deeplink builder
│   ├── application/
│   │   ├── service/                   # Business logic (PeriodService, BillService…)
│   │   └── dto/request|response/      # Request/response DTOs
│   └── interfaces/
│       ├── web/                       # REST controllers + GlobalExceptionHandler
│       └── security/                  # JWT filter, CurrentUser annotation
├── src/main/resources/
│   ├── application.properties         # Production config
│   ├── application-dev.properties     # Dev overrides (H2, longer JWT)
│   └── db/migration/                  # Flyway SQL scripts (V1__, V2__…)
├── frontend/
│   └── src/
│       ├── pages/                     # Page components (one per route)
│       ├── components/ui/             # Shared UI primitives (Badge, Button…)
│       ├── components/layout/         # AppLayout (sidebar + mobile nav)
│       ├── api/                       # Axios API modules per resource
│       ├── context/                   # AuthContext (tokens + user state)
│       ├── lib/                       # utils.ts (cn, formatCurrency), statusMaps.ts
│       ├── types/api.ts               # TypeScript interfaces for all API types
│       └── App.tsx                    # Route definitions
└── pom.xml
```

---

## 5. User Roles & Permissions

| Action | ADMIN | ACCOUNTANT | METER_READER |
|---|:---:|:---:|:---:|
| Login / Refresh / Logout | ✓ | ✓ | ✓ |
| List customers | ✓ | ✓ | ✓ |
| Create / edit / delete customers | ✓ | — | — |
| List periods | ✓ | ✓ | ✓ |
| Create period | ✓ | — | — |
| Submit meter readings | ✓ | ✓ | ✓ |
| Manage EVN invoices | ✓ | ✓ | — |
| Calculate bills | ✓ | ✓ | — |
| Approve period | ✓ | — | — |
| Revert period | ✓ | — | — |
| Close period | ✓ | — | — |
| View / add bills | ✓ | ✓ | — |
| Record payments | ✓ | ✓ | — |
| Assign unmatched payments | ✓ | ✓ | — |
| View debt report | ✓ | ✓ | — |
| View / update system settings | ✓ (edit) | ✓ (read) | — |

---

## 6. State Machines

### Billing Period

```
OPEN ──[all readings submitted, auto]──► READING_DONE
                                              │
                          [POST /calculate, ACCOUNTANT/ADMIN]
                                              │
                                              ▼
                                        CALCULATED
                                              │
                              [POST /approve, ADMIN only]
                                              │
                                              ▼
                                         APPROVED ──[POST /close, ADMIN]──► CLOSED
                                              │
                        [POST /revert, ADMIN — deletes all bills]
                                              │
                                              ▼
                                            OPEN
```

**Rules:**
- `OPEN → READING_DONE`: Automatic when the last reading is submitted.
- `READING_DONE → CALCULATED`: Requires at least one EVN invoice. Creates a bill for every customer in the period.
- `CALCULATED → APPROVED`: ADMIN only. Locks period — no data edits allowed after this point.
- `APPROVED → CLOSED`: ADMIN only.
- `APPROVED → OPEN` (revert): ADMIN only. Deletes all bills. Restores readings to editable state.

### Bill

```
PENDING ──[mark sent]──► SENT ──┐
   │                             │
   └────────────────────────────►│
                                 │   [payment recorded, partial]
                                 ▼
                              PARTIAL ──[full payment]──► PAID
                                 │
                        [overdue scheduler, 2 AM daily*]
                                 ▼
                              OVERDUE

   * Overdue scheduler disabled in dev profile (@Profile("!dev"))
```

**Payment method values:** `BANK_TRANSFER`, `CASH`, `OTHER`

---

## 7. API Reference

Base URL: `http://localhost:8080/api`  
Authentication header: `Authorization: Bearer {accessToken}`

### Auth — `/api/auth`

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| `POST` | `/login` | None | `{ username, password }` → `{ accessToken, refreshToken }` |
| `POST` | `/refresh` | None | `{ refreshToken }` → `{ accessToken }` |
| `POST` | `/logout` | None | `{ refreshToken }` → blacklists token |

### Customers — `/api/customers`

| Method | Path | Roles | Notes |
|---|---|---|---|
| `GET` | `/` | All | `?active=true&size=50&sort=code` |
| `GET` | `/{id}` | ADMIN, ACCOUNTANT | |
| `POST` | `/` | ADMIN | `{ code*, fullName*, phone, zaloPhone, meterSerial, notes }` |
| `PATCH` | `/{id}` | ADMIN | `{ fullName, phone, zaloPhone, meterSerial, notes, active }` |
| `DELETE` | `/{id}` | ADMIN | Soft-delete (sets `active = false`) |

### Billing Periods — `/api/periods`

| Method | Path | Roles | Notes |
|---|---|---|---|
| `GET` | `/` | All | List periods paginated |
| `GET` | `/{id}` | All | |
| `GET` | `/{id}/review` | ADMIN, ACCOUNTANT | Summary stats (collected, outstanding) |
| `POST` | `/` | ADMIN | `{ code*, name*, startDate*, endDate*, serviceUnitPrice* }` |
| `PATCH` | `/{id}` | ADMIN, ACCOUNTANT | Update period metadata |
| `POST` | `/{id}/calculate` | ADMIN, ACCOUNTANT | Triggers bill generation |
| `POST` | `/{id}/approve` | ADMIN | Locks period |
| `POST` | `/{id}/revert` | ADMIN | Unlocks; deletes all bills |
| `POST` | `/{id}/close` | ADMIN | Final state |
| `GET` | `/{id}/print-pack` | ADMIN, ACCOUNTANT | Download PDF of all bills |

### Meter Readings

| Method | Path | Roles | Notes |
|---|---|---|---|
| `GET` | `/api/periods/{periodId}/readings` | All | List readings for a period |
| `PATCH` | `/api/readings/{id}` | All | `{ currentIndex }` — submit reading |

### EVN Invoices — `/api/periods/{periodId}/evn-invoices`

| Method | Path | Roles | Notes |
|---|---|---|---|
| `GET` | `/` | ADMIN, ACCOUNTANT | |
| `POST` | `/` | ADMIN, ACCOUNTANT | `{ invoiceDate*, invoiceNumber*, kwh*, amount* }` |
| `PUT` | `/{id}` | ADMIN, ACCOUNTANT | |
| `DELETE` | `/{id}` | ADMIN, ACCOUNTANT | |

### Bills — `/api/bills`

| Method | Path | Roles | Notes |
|---|---|---|---|
| `GET` | `/` | ADMIN, ACCOUNTANT | `?periodId=` |
| `GET` | `/{id}` | ADMIN, ACCOUNTANT | |
| `POST` | `/{id}/payments` | ADMIN, ACCOUNTANT | `{ amount*, method*, paidAt*, notes }` |
| `POST` | `/{id}/mark-sent` | ADMIN, ACCOUNTANT | Sets status SENT, sentViaZalo=true |
| `GET` | `/{id}/zalo-link` | ADMIN, ACCOUNTANT | Returns Zalo deeplink URL |

### Payments — `/api/payments`

| Method | Path | Roles | Notes |
|---|---|---|---|
| `GET` | `/unmatched` | ADMIN, ACCOUNTANT | Payments with no bill assigned |
| `POST` | `/{id}/assign` | ADMIN, ACCOUNTANT | `{ billId }` — link to bill |

### SePay Webhook — `/api/webhooks/sepay`

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/` | `Apikey {SEPAY_WEBHOOK_SECRET}` header | Always returns `{ "success": true }` HTTP 200 |

### Reports — `/api/reports`

| Method | Path | Roles | Notes |
|---|---|---|---|
| `GET` | `/debt` | ADMIN, ACCOUNTANT | All unpaid/partial bills across periods |
| `GET` | `/period/{id}` | ADMIN, ACCOUNTANT | Period summary: billed, collected, outstanding |

### System Settings — `/api/settings`

| Method | Path | Roles | Notes |
|---|---|---|---|
| `GET` | `/` | ADMIN, ACCOUNTANT | List all key-value settings |
| `PATCH` | `/{key}` | ADMIN | `{ value }` |

**Known setting keys:** `bank_account_number`, `bank_account_holder`, `overdue_days`

---

## 8. Frontend Routes

| Path | Page | Sidebar visibility |
|---|---|---|
| `/login` | LoginPage | (public) |
| `/` | DashboardPage | All roles |
| `/periods` | PeriodsPage | All roles |
| `/periods/:id` | PeriodDetailPage | All roles |
| `/customers` | CustomersPage | ADMIN, ACCOUNTANT |
| `/reports` | ReportsPage | ADMIN, ACCOUNTANT |
| `/settings` | SettingsPage | ADMIN only |

**Role-based sidebar filtering** is enforced in `AppLayout.tsx`. API-level authorization is independently enforced via `@PreAuthorize` on every backend endpoint.

### Key UI behaviors by role

**METER_READER** (mobile-optimized):
- Sees Tổng quan + Kỳ điện only in sidebar
- PeriodDetailPage shows unsubmitted readings first, large numeric input, one-tap submit
- Progress bar shows how many readings are done

**ACCOUNTANT**:
- Sees Khách hàng + Báo cáo in addition
- Can manage EVN invoices, calculate bills, record payments
- Cannot approve or revert periods

**ADMIN**:
- Sees all pages including Cài đặt
- Can approve/revert/close periods
- CRUD on customers and settings

---

## 9. Configuration Reference

### `application.properties` (production)

```properties
spring.application.name=electricity-billing-system
spring.datasource.url=jdbc:mysql://localhost:3306/electricity_billing?...
spring.datasource.username=${DB_USERNAME:root}
spring.datasource.password=${DB_PASSWORD:123456}
spring.jpa.hibernate.ddl-auto=validate          # Flyway owns the schema
app.jwt.access-token-expiration-ms=900000        # 15 minutes
app.jwt.refresh-token-expiration-ms=604800000    # 7 days
app.upload.dir=${UPLOAD_DIR:uploads}
app.sepay.webhook-secret=${SEPAY_WEBHOOK_SECRET:dev-secret}
```

### `application-dev.properties` (dev overrides)

```properties
spring.jpa.show-sql=true
app.jwt.access-token-expiration-ms=3600000       # 1 hour (Postman convenience)
app.upload.dir=uploads-dev
```

---

## 10. Common Workflows

### Full billing cycle (end-to-end)

```
1.  Admin creates period (POST /api/periods)
2.  Reader submits meter readings (PATCH /api/readings/{id} for each customer)
        → Period auto-transitions OPEN → READING_DONE when last reading submitted
3.  Accountant adds EVN invoice (POST /api/periods/{id}/evn-invoices)
4.  Accountant triggers calculation (POST /api/periods/{id}/calculate)
        → Bills generated for all customers; period → CALCULATED
5.  Admin reviews via period detail page
6.  Admin approves (POST /api/periods/{id}/approve) → period → APPROVED (locked)
7.  Accountant sends bills via Zalo (POST /api/bills/{id}/mark-sent)
8.  Accountant records payments (POST /api/bills/{id}/payments)
        OR bank webhook auto-matches via SePay (POST /api/webhooks/sepay)
9.  Admin closes period (POST /api/periods/{id}/close) → CLOSED
```

### Postman quick-start (dev profile)

```
1.  POST /api/auth/login  { "username": "admin", "password": "Admin@123" }
    → copy accessToken
2.  Set Authorization header: Bearer {accessToken}
3.  GET /api/periods  → see 3 seeded periods
4.  GET /api/periods/3/readings  → see 4 unsubmitted readings for 2025-04
5.  PATCH /api/readings/{id}  { "currentIndex": 1600 }  → submit a reading
```

### Assigning an unmatched payment (Period 2025-03)

```
1.  GET /api/payments/unmatched  → find TXN-UNMATCHED-202503
2.  GET /api/bills?periodId={p2Id}  → find a PENDING bill (KH004–KH009)
3.  POST /api/payments/{unmatchedId}/assign  { "billId": {billId} }
```

---

## 11. Developer Notes

### MeterReading.consumption is a generated column
`consumption` is a MySQL `STORED GENERATED COLUMN` (`currentIndex - previousIndex`). JPA has `insertable=false, updatable=false` on it. **Never set `.consumption(...)` in a builder** — set `previousIndex` and `currentIndex` and let the DB compute it. In H2 (dev), the column behaves as a plain INT.

### Flyway owns the schema
`spring.jpa.hibernate.ddl-auto=validate` — Hibernate only validates, Flyway migrates. Always add a `Vn__description.sql` file for schema changes instead of modifying entities directly.

### Do not call service layer from DataInitializer
`DataInitializer` saves entities directly via repositories, bypassing services. This is intentional — services enforce state machine rules and fire audit events that break the seeding. Direct repository saves avoid all of that.

### OverdueScheduler is disabled in dev
`OverdueScheduler` is annotated `@Profile("!dev")` — it does not register as a Spring bean in dev mode. This prevents the 2 AM cron from marking seeded 2025 bills as OVERDUE.

### Frontend status maps are shared
`frontend/src/lib/statusMaps.ts` exports `periodStatusLabel`, `periodStatusVariant`, `billStatusLabel`, `billStatusVariant`. Import from here instead of re-declaring in each page.

### API error extraction pattern
```typescript
const e = err as { response?: { data?: { error?: string } } }
const message = e.response?.data?.error ?? 'Fallback message'
```
All backend error responses use `ApiResponse<null>` with the `error` field set.

### Authentication flow (frontend)
Tokens are managed in `AuthContext`. Axios interceptors in `api/client.ts` automatically attach `Authorization: Bearer {token}` headers and handle token refresh on 401 responses.
