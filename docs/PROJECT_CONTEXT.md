# Project Context — Electricity Billing System

> Tài liệu này mô tả **trạng thái hiện tại** của hệ thống, dành cho Claude Code
> (và developer mới) để nắm bắt nhanh context mà không cần đọc toàn bộ code.
> Cập nhật lần cuối: 2026-05-06

---

## 1. Mô tả hệ thống

Hệ thống quản lý tiền điện cho một khu nhà ≈100 hộ dùng chung một đồng hồ tổng của EVN.
Mỗi tháng, nhân viên đọc chỉ số từng hộ, nhập hóa đơn EVN tổng, tính đơn giá theo tỉ lệ
tiêu thụ, tạo hóa đơn cho từng hộ và thu tiền.

---

## 2. Stack kỹ thuật

| Layer | Công nghệ |
|-------|-----------|
| Backend | Spring Boot 4.0.0 · Java 17 · MySQL 8 · Flyway · Spring Data JPA · Lombok |
| Security | Spring Security + JJWT (stateless, 8-hour tokens, no refresh) |
| Frontend | React 19 + TypeScript + Tailwind CSS · Vite · Axios |
| Dev tools | H2 in-memory (tests) · DataInitializer (dev profile seeding) |

Base package: `com.loc.electricity`  
Frontend path: `frontend/` (subdirectory, same repo)

---

## 3. Cấu trúc package backend

```
com.loc.electricity
├── application
│   ├── dto
│   │   ├── request/   LoginRequest, CreatePeriodRequest, UpdatePeriodRequest,
│   │   │              CreateEvnInvoiceRequest, CreatePaymentRequest, ...
│   │   └── response/  LoginResponse, PeriodResponse, PeriodReviewResponse,
│   │                  BillResponse, EvnInvoiceResponse, MeterReadingResponse, ...
│   ├── exception/     BusinessException, ResourceNotFoundException,
│   │                  InvalidStateTransitionException, PeriodLockedException
│   └── service/       AuthService, PeriodService, PeriodWriteGuard,
│                      CalculationEngine, BillService, PaymentService,
│                      MeterReadingService, EvnInvoiceService,
│                      OverdueScheduler (@Profile("!dev")),
│                      SystemSettingService
├── config/            SecurityConfig, DataInitializer (@Profile("dev"))
├── domain
│   ├── bill/          Bill, BillStatus
│   ├── customer/      Customer
│   ├── period/        BillingPeriod, EvnInvoice, PeriodStatus
│   ├── reading/       MeterReading
│   ├── shared/        AuditAction, AuditEvent, PeriodApprovedEvent
│   └── user/          User, RefreshToken (unused, kept for migration compat)
├── infrastructure
│   ├── persistence/   *Repository interfaces (Spring Data JPA)
│   ├── pdf/           PdfGenerationService (OpenPDF, A5 portrait)
│   └── zalo/          ZaloDeeplinkBuilder
└── interfaces
    ├── security/      JwtAuthenticationFilter, JwtTokenProvider,
    │                  SepayWebhookAuthFilter, UserDetailsServiceImpl
    └── web/           AuthController, PeriodController, CustomerController,
                       BillController, PaymentController, ReportController,
                       SettingsController, WebhookController, GlobalExceptionHandler
```

---

## 4. Cấu trúc frontend

```
frontend/src/
├── api/          auth.ts, periods.ts, customers.ts, bills.ts, readings.ts, client.ts
├── components/
│   ├── layout/   AppLayout.tsx (sidebar + header)
│   └── ui/       Button, Input, Label, Badge, Dialog (shadcn-style)
├── context/      AuthContext.tsx (JWT stored in localStorage)
├── lib/          utils.ts (cn, formatCurrency), statusMaps.ts
├── pages/        LoginPage, DashboardPage, CustomersPage, PeriodsPage,
│                 PeriodDetailPage, ReportsPage, SettingsPage
└── types/        api.ts (all TypeScript interfaces)
```

---

## 5. Database schema (Flyway V1–V5)

| Bảng | Ghi chú quan trọng |
|------|--------------------|
| `user` | 3 cố định: admin / accountant / reader |
| `customer` | `active` = soft-delete |
| `billing_period` | State machine trung tâm; `approvedBy`, `accountantVerifiedBy` → `FetchType.EAGER` |
| `evn_invoice` | `kwh` + `amount` (V4 thêm TOU, V5 revert lại) |
| `meter_reading` | `consumption` = STORED GENERATED COLUMN (current_index − previous_index); không được set trong Java |
| `bill` | UNIQUE(period_id, customer_id); `payment_code` = `"TIENDIEN {period_code} {customer_code}"` |
| `payment` | `bill_id` nullable (unmatched bank transfers) |
| `system_setting` | Seed bởi Flyway V1; `default_service_fee`, `overdue_days`, `loss_warning_threshold`, ... |
| `audit_log` | JSON before/after cho mọi thao tác tài chính |
| `refresh_token` | Còn trong schema nhưng không được sử dụng (security đã simplify) |

---

## 6. Lifecycle kỳ tính điện (PeriodStatus state machine)

```
OPEN ──► READING_DONE ──► CALCULATED ─────────► APPROVED  ───────► CLOSED
                               ▲                                      │
                               └──── revert (từ CALC hoặc APPROVED) ◄─┘
```

| Transition | Endpoint | Role | Điều kiện |
|------------|----------|------|-----------|
| OPEN → READING_DONE | POST `/periods/{id}/submit-readings` | METER_READER | - |
| READING_DONE → CALCULATED | POST `/periods/{id}/calculate` | ACCOUNTANT/ADMIN | Cần ≥1 EVN invoice |
| CALCULATED → CALCULATED | POST `/periods/{id}/verify` | ACCOUNTANT/ADMIN | Sets `accountantVerifiedAt` |
| CALCULATED → APPROVED | POST `/periods/{id}/approve` | ADMIN | Cần `accountantVerifiedAt != null` |
| APPROVED → CLOSED | POST `/periods/{id}/close` | ADMIN | - |
| CALC/APPROVED → OPEN | POST `/periods/{id}/revert` | ADMIN | Xóa bills, reset verify/approve |

---

## 7. Công thức tính tiền (Spec V2 — hiện tại)

```
unit_price = (evn_total_amount + extra_fee) / total_actual_consumption
             DECIMAL(10,2), HALF_UP

electricity_amount = unit_price × consumption           ← làm tròn đến đồng nguyên (0 decimal)
service_amount     = service_fee                        ← FLAT, không nhân với kWh
total_amount       = electricity_amount + service_amount
```

**Ví dụ kiểm tra (clean numbers):**
- EVN: 2.860 kWh, 4.290.000 đ; extraFee = 0; tổng thực tế = 2.750 kWh
- unit_price = 4.290.000 / 2.750 = **1.560 đ/kWh**
- KH001 (300 kWh): 300 × 1.560 + 10.000 = **478.000 đ**
- Hao hụt: 110 kWh = 3,85% (ngưỡng cảnh báo: 15%)

**Quan trọng:** `service_fee` là phí cố định mỗi hộ mỗi kỳ (không nhân với kWh).
Đây là thay đổi từ Spec V1 (service_unit_price × consumption).

---

## 8. API Endpoints đầy đủ

```
POST   /api/auth/login
POST   /api/auth/logout                              (no-op, stateless)

GET    /api/customers?page=&size=&search=            ADMIN/ACCOUNTANT/METER_READER
POST   /api/customers                                ADMIN
GET    /api/customers/{id}                           ADMIN/ACCOUNTANT
PATCH  /api/customers/{id}                           ADMIN
DELETE /api/customers/{id}                           ADMIN (soft delete)

GET    /api/periods?page=&size=                      authenticated
POST   /api/periods                                  ADMIN
GET    /api/periods/current                          authenticated
GET    /api/periods/{id}                             authenticated
PATCH  /api/periods/{id}                             ADMIN/ACCOUNTANT (name, extraFee, serviceFee)
GET    /api/periods/{id}/review                      ACCOUNTANT/ADMIN
POST   /api/periods/{id}/submit-readings             METER_READER
POST   /api/periods/{id}/calculate                   ACCOUNTANT/ADMIN
POST   /api/periods/{id}/verify                      ACCOUNTANT/ADMIN
POST   /api/periods/{id}/approve                     ADMIN
POST   /api/periods/{id}/revert                      ADMIN
POST   /api/periods/{id}/close                       ADMIN
GET    /api/periods/{id}/print-pack                  ACCOUNTANT/ADMIN (PDF blob)

GET    /api/periods/{id}/evn-invoices                ACCOUNTANT/ADMIN
POST   /api/periods/{id}/evn-invoices                ACCOUNTANT/ADMIN
DELETE /api/periods/{id}/evn-invoices/{invoiceId}    ACCOUNTANT/ADMIN

GET    /api/periods/{id}/readings                    authenticated

GET    /api/bills?periodId=                          ACCOUNTANT/ADMIN
GET    /api/bills/{id}/pdf                           ACCOUNTANT/ADMIN
GET    /api/bills/{id}/zalo-link                     ACCOUNTANT/ADMIN
POST   /api/bills/{id}/mark-sent                     ACCOUNTANT/ADMIN
POST   /api/bills/{id}/payments                      ACCOUNTANT/ADMIN

PATCH  /api/payments/{id}/assign                     ACCOUNTANT/ADMIN

GET    /api/reports/period-summary?periodId=         ACCOUNTANT/ADMIN
GET    /api/reports/debt                             ACCOUNTANT/ADMIN

GET    /api/settings                                 ADMIN
PATCH  /api/settings/{key}                           ADMIN

POST   /api/webhooks/sepay                           Apikey auth
```

---

## 9. Security

- **Stateless JWT** — không có refresh token, access token có hạn 8 tiếng
- Token lưu trong `localStorage` (frontend)
- `refresh_token` table còn trong DB nhưng hoàn toàn không được dùng
- `SepayWebhookAuthFilter` xử lý webhook riêng (header `Apikey {secret}`)

---

## 10. Dev workflow

```bash
# 1. Xóa dữ liệu cũ (giữ user/customer):
mysql -u root -p electricity_billing < sql/clear_billing_data.sql

# 2. Chạy backend với dev profile:
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
# → DataInitializer chạy nếu user "admin" chưa tồn tại

# 3. Chạy frontend:
cd frontend && npm run dev

# 4. Test theo kịch bản:
# Xem docs/TEST_SCENARIO.md
```

**Tài khoản dev:** `admin/Admin@123` · `accountant/Account@123` · `reader/Reader@123`

---

## 11. Những quyết định kiến trúc quan trọng

| Quyết định | Lý do |
|------------|-------|
| `service_fee` là flat fee (không nhân kWh) | Spec V2: phí ghi điện cố định/hộ/kỳ, không tỉ lệ kWh |
| OPEN→READING_DONE là explicit (không auto) | Cho phép reader ghi xong rồi mới xác nhận, không tự động khi 100% done |
| `accountantVerifiedAt` bắt buộc trước khi approve | 4-eyes check: kế toán xem hao hụt trước khi admin ký duyệt |
| `approvedBy`/`accountantVerifiedBy` EAGER | Tránh LazyInitializationException khi map PeriodResponse ngoài transaction |
| Bỏ refresh token | Hệ thống nội bộ 3 user, 8h là đủ cho một ngày làm việc |
| REVERT từ APPROVED được | Sai sót có thể xảy ra sau khi duyệt; cần rollback path |
| Không gọi service layer từ DataInitializer | Service fires audit events và enforce state machine — bypass bằng repository trực tiếp |
