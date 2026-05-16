# Electricity Billing System — MVP Specification

**Version:** 1.0
**Last updated:** 2026-04-30
**Owner:** Lộc
**Stack:** Spring Boot 3 + Java 21 + MySQL 8 + React 19 + Tailwind

---

## 1. Tổng quan

Hệ thống thay thế quy trình tính tiền điện bằng giấy + Excel + tool Java rời rạc hiện tại. Mô hình kinh doanh là **đồng hồ tổng (EVN) → đồng hồ con (~100 hộ)**: chủ ký 1 hợp đồng với EVN, đọc đồng hồ con từng hộ, chia tiền hóa đơn EVN theo tỷ lệ tiêu thụ, cộng thêm tiền công vận hành, sau đó phát hóa đơn và thu tiền.

### 1.1. Phạm vi MVP

**Trong scope:**
- Quản lý 100 khách hàng (CRUD)
- Tạo kỳ tính tiền linh hoạt (1 tháng hoặc liên tục nhiều tháng)
- Nhập chỉ số đồng hồ qua web (responsive cho mobile)
- Nhập hóa đơn EVN, tính đơn giá tự động
- Workflow review/approve 4 bước
- Sinh PDF hóa đơn + VietQR
- In hàng loạt cho khách thanh toán tiền mặt
- SePay webhook → auto gạch nợ chuyển khoản TPBank
- Zalo deeplink (bán tự động) thông báo
- Báo cáo công nợ cơ bản
- Audit log mọi thao tác trên dữ liệu tiền

**Ngoài scope MVP:**
- Mobile app native
- Zalo OA / ZNS (xét sau)
- Đa hợp đồng EVN / đa khu vực
- Báo cáo nâng cao (biểu đồ xu hướng, phân tích)
- Đồng bộ với accounting software
- Multi-tenant

---

## 2. Thuật ngữ

| Thuật ngữ | Định nghĩa |
|---|---|
| **EVN invoice** | Hóa đơn điện tử/giấy mà EVN gửi cho chủ (đồng hồ tổng) |
| **Meter reading** | Lần đọc đồng hồ con của 1 khách hàng trong 1 kỳ |
| **Billing period** | Kỳ tính tiền (thường 1 tháng, có thể 2-3 tháng liên tục) |
| **Bill** | Hóa đơn cho 1 khách hàng trong 1 kỳ |
| **Unit price** (`unit_price`) | Đơn giá điện đ/kWh, tính từ tổng EVN ÷ tổng kWh tiêu thụ các hộ |
| **Service unit price** (`service_unit_price`) | Đơn giá tiền công đ/kWh, do ADMIN ấn định |
| **Payment code** | Chuỗi định danh dùng trong nội dung CK để SePay tự match |
| **Hao hụt** | Chênh lệch giữa kWh đo trên đồng hồ tổng và tổng kWh đo trên đồng hồ con (không model thành entity riêng — đã hấp thụ vào `extra_fee` của period) |

---

## 3. User & phân quyền

3 vai trò, không trùng:

| Role | Capability |
|---|---|
| **METER_READER** | Tạo/cập nhật `meter_reading` ở period status=`OPEN`. Không xem được dữ liệu tài chính. |
| **ACCOUNTANT** | Tạo/cập nhật `evn_invoice`, `extra_fee`, `service_unit_price`. Trigger calculation. **KHÔNG** approve được. **KHÔNG** sửa được sau khi approved. |
| **ADMIN** | Toàn quyền. Là người duy nhất approve được period. Quản lý user, customer, settings. |

**Nguyên tắc bất biến:**
- Sau khi `billing_period.status = APPROVED`, không user nào sửa được dữ liệu của period đó (kể cả ADMIN). Muốn sửa phải explicit `revert` về CALCULATED, hành động này được audit log.
- Tất cả write action quan trọng (tạo/sửa reading, EVN invoice, calculate, approve, mark paid) → ghi `audit_log`.

---

## 4. Domain model

### 4.1. ERD (text)

```
┌──────────────┐        ┌────────────────────┐        ┌──────────────┐
│   customer   │◄──────►│   meter_reading    │◄──────►│billing_period│
└──────┬───────┘ 1:N    └────────────────────┘  N:1   └──────┬───────┘
       │                                                      │
       │                ┌──────────────┐                       │
       └───────────────►│     bill     │◄──────────────────────┘
                        └──────┬───────┘  N:1
                               │
                        ┌──────▼───────┐         ┌──────────────┐
                        │   payment    │         │ evn_invoice  │
                        └──────────────┘         └──────┬───────┘
                                                        │
                                          billing_period (1:N)
```

### 4.2. Entities

#### `customer`
Khách hàng dùng điện. Bất biến qua các kỳ.

| Field | Type | Note |
|---|---|---|
| id | BIGINT PK | |
| code | VARCHAR(20) UNIQUE | "ND001", "ND002"... — dùng trong payment_code |
| full_name | VARCHAR(200) | "Đinh Chí Đệ", "Năm công + Bảy Đậu" (cho phép tên ghép) |
| phone | VARCHAR(20) | |
| zalo_phone | VARCHAR(20) | có thể trùng `phone`, dùng cho deeplink Zalo |
| meter_serial | VARCHAR(50) | |
| notes | TEXT | |
| active | BOOLEAN | KH ngừng dùng → `false`, không xuất hiện ở kỳ mới |

#### `billing_period`
Kỳ tính tiền.

| Field | Type | Note |
|---|---|---|
| id | BIGINT PK | |
| code | VARCHAR(20) UNIQUE | "2026-05" hoặc "2026-04-05" (auto-generate từ start_date) |
| name | VARCHAR(100) | Display: "Tháng 5/2026" hoặc "Tháng 4+5/2026" (user nhập) |
| start_date | DATE | |
| end_date | DATE | >= start_date |
| evn_total_amount | DECIMAL(15,2) | Tổng từ tất cả `evn_invoice` của kỳ (cache, derive được) |
| evn_total_kwh | INT | Tổng kWh từ EVN |
| extra_fee | DECIMAL(15,2) | Phụ phí vận hành/hao hụt |
| unit_price | DECIMAL(10,2) | Đơn giá điện, tính sau khi calculate |
| service_unit_price | DECIMAL(10,2) | Đơn giá tiền công, default từ system_setting, override được |
| status | ENUM | `OPEN` → `READING_DONE` → `CALCULATED` → `APPROVED` → `CLOSED` |
| approved_by | BIGINT FK user | |
| approved_at | TIMESTAMP NULL | |
| closed_at | TIMESTAMP NULL | |

#### `evn_invoice`
Hóa đơn EVN nhập tay. 1 kỳ có 1-N hóa đơn.

| Field | Type | Note |
|---|---|---|
| id | BIGINT PK | |
| period_id | BIGINT FK | |
| invoice_date | DATE | |
| invoice_number | VARCHAR(50) | |
| kwh | INT | |
| amount | DECIMAL(15,2) | |
| attachment_url | VARCHAR(500) | ảnh hóa đơn (S3/local), optional |

#### `meter_reading`
Số đo đồng hồ con. UNIQUE(period_id, customer_id).

| Field | Type | Note |
|---|---|---|
| id | BIGINT PK | |
| period_id | BIGINT FK | |
| customer_id | BIGINT FK | |
| previous_index | INT | Auto-fill từ `current_index` của reading kỳ liền trước |
| current_index | INT | METER_READER nhập, >= `previous_index` |
| consumption | INT GENERATED | `current_index - previous_index`, STORED column |
| reading_photo_url | VARCHAR(500) | ảnh đồng hồ, optional nhưng khuyến khích |
| read_at | TIMESTAMP | |
| read_by | BIGINT FK user | |

**Validation:**
- `current_index >= previous_index` (CHECK constraint)
- Cảnh báo (không reject) nếu `consumption` lệch >300% so với 3 kỳ trước

#### `bill`
Hóa đơn cho khách hàng. UNIQUE(period_id, customer_id). Tạo bởi calculation engine.

| Field | Type | Note |
|---|---|---|
| id | BIGINT PK | |
| period_id | BIGINT FK | |
| customer_id | BIGINT FK | |
| consumption | INT | snapshot từ reading |
| unit_price | DECIMAL(10,2) | snapshot từ period.unit_price tại thời điểm calculate |
| service_unit_price | DECIMAL(10,2) | snapshot từ period |
| electricity_amount | DECIMAL(15,2) | `consumption × unit_price` |
| service_amount | DECIMAL(15,2) | `consumption × service_unit_price` |
| total_amount | DECIMAL(15,2) | `electricity_amount + service_amount` |
| paid_amount | DECIMAL(15,2) | tổng `payment.amount` đã match |
| status | ENUM | `PENDING` → `SENT` → `PARTIAL` / `PAID` / `OVERDUE` |
| payment_code | VARCHAR(50) UNIQUE | Format: `TIENDIEN {period_code} {customer_code}` |
| qr_code_url | VARCHAR(500) | |
| pdf_url | VARCHAR(500) | |
| sent_via_zalo | BOOLEAN | đánh dấu đã bấm gửi Zalo |
| sent_at | TIMESTAMP NULL | |

**Vì sao snapshot `unit_price` và `service_unit_price` vào `bill`:** Nếu sau này admin lỡ tay sửa `billing_period.unit_price` (dù workflow chặn nhưng phòng hờ), số tiền trên bill đã in/gửi cho khách không bị thay đổi.

#### `payment`
Giao dịch thanh toán. Có thể NULL `bill_id` (CK không match → chờ ADMIN gán thủ công).

| Field | Type | Note |
|---|---|---|
| id | BIGINT PK | |
| bill_id | BIGINT FK NULL | NULL nếu CK không match được bill |
| amount | DECIMAL(15,2) | |
| method | ENUM | `BANK_TRANSFER`, `CASH`, `OTHER` |
| paid_at | TIMESTAMP | |
| bank_transaction_id | VARCHAR(100) UNIQUE | id của SePay, idempotency |
| bank_reference_code | VARCHAR(100) | referenceCode từ SePay |
| raw_content | TEXT | nội dung CK gốc, audit |
| recorded_by | BIGINT FK user | NULL nếu auto từ webhook |
| notes | TEXT | |

#### `system_setting`
Key-value config có thể edit từ UI.

| setting_key | Default | Mô tả |
|---|---|---|
| `default_service_unit_price` | "100" | Đơn giá tiền công mặc định (đ/kWh) |
| `payment_code_prefix` | "TIENDIEN" | Prefix cho mã thanh toán |
| `bank_account_number` | "" | TK TPBank nhận tiền |
| `bank_account_holder` | "" | Chủ TK |
| `overdue_days` | "30" | Số ngày sau APPROVED chuyển bill thành OVERDUE |

#### `audit_log`
Mọi mutation quan trọng. JSON before/after.

---

## 5. State machines

### 5.1. `billing_period.status`

```
                  ┌────────────────────── revert (ADMIN) ──────┐
                  ▼                                            │
    ┌──────────┐ all readings ┌──────────────┐  calculate ┌────┴─────┐
    │   OPEN   │─────────────►│ READING_DONE │───────────►│CALCULATED│
    └──────────┘  submitted   └──────────────┘            └────┬─────┘
                                                               │ approve (ADMIN)
                                                               ▼
    ┌──────────┐  close (ADMIN)  ┌──────────┐
    │  CLOSED  │◄────────────────│ APPROVED │
    └──────────┘                 └──────────┘
                       (no further edits)
```

**Transitions:**
| From | To | Action | Role | Side effects |
|---|---|---|---|---|
| `-` | `OPEN` | Create period | ADMIN | Auto-clone `customer` list, init `meter_reading` rows với `previous_index` = current_index kỳ trước |
| `OPEN` | `READING_DONE` | All readings submitted | METER_READER (auto khi đủ) | — |
| `READING_DONE` | `CALCULATED` | Calculate bills | ACCOUNTANT | Tính `unit_price`, tạo N `bill` records |
| `CALCULATED` | `OPEN` | Revert | ADMIN | Xóa toàn bộ `bill` của period |
| `CALCULATED` | `APPROVED` | Approve | ADMIN | Lock period; sinh PDF + QR cho từng bill |
| `APPROVED` | `CLOSED` | Close period | ADMIN | Optional, cho phép archive |

### 5.2. `bill.status`

```
                        ┌───── partial payment ─────┐
                        │                           │
   ┌───────┐  send  ┌───┴──┐ full payment  ┌──────┐ │
   │PENDING│───────►│ SENT │──────────────►│ PAID │ │
   └───────┘        └──┬───┘               └──────┘ │
                       │                            │
                       │   overdue_days passed      ▼
                       │                       ┌─────────┐
                       └──────────────────────►│OVERDUE  │
                                               └─────────┘
                                                  │
                                          payment ▼
                                               ┌──────┐
                                               │ PAID │
                                               └──────┘
```

`PARTIAL` xảy ra khi `0 < paid_amount < total_amount`.

---

## 6. Calculation engine

### 6.1. Công thức (chuẩn hóa từ Excel cũ)

```
Cho 1 billing_period:

  evn_total_amount   = Σ evn_invoice.amount
  total_consumption  = Σ meter_reading.consumption (của tất cả KH active)

  unit_price = (evn_total_amount + extra_fee) / total_consumption
             [làm tròn đến đơn vị đồng]

Cho từng bill (mỗi customer):

  consumption        = meter_reading.consumption
  electricity_amount = consumption × unit_price
  service_amount     = consumption × service_unit_price
  total_amount       = electricity_amount + service_amount
```

### 6.2. Worked example (lấy từ file Excel kỳ T4+5/2013)

**Input:**
- 2 EVN invoices: 5,394,850 + 1,974,460 = 7,369,310
- extra_fee: 177,109 (hao hụt)
- total_consumption: 4,819 kWh
- service_unit_price: 100 đ/kWh

**Tính:**
```
unit_price = (7,369,310 + 177,109) / 4,819
           = 7,546,419 / 4,819
           = 1,565.97
           ≈ 1,566 đ/kWh
```

**Bill mẫu cho "Bảy Hồng" (consumption = 1,111 kWh):**
```
electricity_amount = 1,111 × 1,566 = 1,739,826
service_amount     = 1,111 × 100   =   111,100
total_amount                       = 1,850,926
```
✓ khớp với file Excel.

### 6.3. Rounding policy

- `unit_price`: làm tròn đến đồng (DECIMAL(10,2) nhưng UI hiển thị làm tròn lên — config được).
- `electricity_amount`, `service_amount`, `total_amount`: tính từ `unit_price` đã làm tròn → giữ nguyên (không làm tròn thêm).
- Tổng các `total_amount` có thể chênh ±vài đồng so với `evn_total_amount + Σ service_amount` do rounding. Hệ thống hiển thị chênh lệch này ở màn hình Review.

### 6.4. Edge cases

| Case | Xử lý |
|---|---|
| `total_consumption = 0` | Reject calculation. Hiện thông báo: "Tất cả KH đều có consumption=0, không thể tính đơn giá." |
| 1 KH có `consumption = 0` | Bill vẫn tạo với `total_amount = 0`, status=`PAID` luôn. |
| KH mới gia nhập giữa kỳ | Tạo customer với `previous_index = current_index` của lần đọc đầu → consumption = 0 cho kỳ join. Kỳ sau bình thường. |
| KH cũ ngừng dùng | Set `customer.active = false`. Period mới không tự tạo `meter_reading` cho KH này. |
| Đồng hồ bị thay (reset về 0) | METER_READER nhập `current_index = 0` → consumption âm → CHECK constraint fail. Workaround: ADMIN edit `previous_index = 0` cho riêng row đó, ghi notes. |

---

## 7. Core workflows

### 7.1. Tạo kỳ và đọc đồng hồ

```
ADMIN: POST /api/periods
  body: { name, start_date, end_date, service_unit_price? }
  → tạo period status=OPEN
  → background job clone meter_reading template cho mọi customer.active=true,
    auto-fill previous_index từ kỳ trước (hoặc 0 nếu KH mới)

METER_READER (mobile):
  GET /api/periods/current/readings → list readings của mình (chưa nhập)
  PATCH /api/readings/{id} { current_index, photo_url } → save từng cái
  Khi đủ 100/100 → backend tự transition OPEN → READING_DONE
```

### 7.2. Tính tiền và review

```
ACCOUNTANT:
  POST /api/periods/{id}/evn-invoices [{date, number, kwh, amount}, ...]
  PATCH /api/periods/{id} { extra_fee, service_unit_price }
  POST /api/periods/{id}/calculate
    → server tính unit_price
    → tạo N bill rows (snapshot)
    → period.status = CALCULATED

ADMIN review tại GET /api/periods/{id}/review
  → trả summary: tổng EVN, tổng kWh, đơn giá, danh sách bill, chênh lệch rounding
  → có 2 nút:
     [Yêu cầu sửa] → POST /api/periods/{id}/revert (xóa bills, OPEN)
     [Duyệt phát hành] → POST /api/periods/{id}/approve
                       → period.status = APPROVED
                       → background job: gen PDF + VietQR cho mọi bill
                       → bill.status = SENT khi PDF sẵn sàng
```

### 7.3. Phát hành & gửi thông báo

```
ADMIN bấm "In hàng loạt":
  GET /api/periods/{id}/bills/print-pack
  → server merge tất cả PDF → trả 1 file PDF lớn (mỗi bill 1 trang A5/A4)
  → ADMIN tải về, in, đi giao tận tay (cho khách tiền mặt)

ADMIN bấm "Gửi Zalo":
  GET /api/periods/{id}/bills?status=SENT
  → frontend render mỗi bill thành 1 button
  → click → mở zalo.me/{phone}?text={template}
    template: "Chào {name}, hóa đơn tiền điện kỳ {period} của bạn:
              Tiêu thụ: {consumption} kWh
              Tổng: {total_amount} đ
              QR thanh toán: {qr_url}
              Hoặc CK: TPBank - {acc_no} - ND {payment_code}"
  → ADMIN ấn Send trong app Zalo
  → frontend mark sent_via_zalo = true
```

### 7.4. Thu tiền (auto + manual)

```
[AUTO - chuyển khoản]
TPBank → SePay → POST /api/webhooks/sepay
  body: { id, gateway:"TPBank", transferAmount, content, referenceCode, ... }

  Backend handler:
    1. Idempotency check: SELECT * FROM payment WHERE bank_transaction_id = ?
       → nếu có, return 200 ngay (đã xử lý)
    2. Parse content: regex /TIENDIEN\s+(\S+)\s+(\S+)/i
       → extract period_code, customer_code
    3. Tìm bill: WHERE payment_code = "TIENDIEN " + period_code + " " + customer_code
    4. Nếu thấy bill:
       - INSERT payment với bill_id
       - UPDATE bill.paid_amount += transferAmount
       - UPDATE bill.status = PAID nếu paid_amount >= total_amount
                           = PARTIAL nếu 0 < paid_amount < total_amount
    5. Nếu không thấy:
       - INSERT payment với bill_id = NULL
       - Notify ADMIN qua dashboard (badge "X giao dịch chưa khớp")
    6. Return 200 OK { success: true }

[MANUAL - tiền mặt hoặc CK lạ]
ADMIN/ACCOUNTANT:
  POST /api/bills/{id}/payments { amount, method:"CASH", paid_at, notes }
  → tương tự logic trên nhưng method=CASH
```

---

## 8. REST API (overview)

Convention: tất cả response dạng `{ data: ..., error: null }` hoặc `{ data: null, error: { code, message } }`. Auth: JWT trong header `Authorization: Bearer {token}`.

### Auth
| Method | Path | Role | Mô tả |
|---|---|---|---|
| POST | `/api/auth/login` | public | Trả JWT |
| POST | `/api/auth/refresh` | any | Refresh token |
| POST | `/api/auth/logout` | any | |

### Customers
| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/customers` | ADMIN, ACCOUNTANT | List, filter `?active=true` |
| POST | `/api/customers` | ADMIN | Create |
| PATCH | `/api/customers/{id}` | ADMIN | Update |
| DELETE | `/api/customers/{id}` | ADMIN | Soft delete (set active=false) |
| POST | `/api/customers/import` | ADMIN | Bulk import từ Excel/CSV |

### Periods
| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/periods` | all | List |
| GET | `/api/periods/{id}` | all (filter fields theo role) | Detail |
| GET | `/api/periods/current` | all | Period đang OPEN/READING_DONE |
| POST | `/api/periods` | ADMIN | Create new period |
| PATCH | `/api/periods/{id}` | ACCOUNTANT (chỉ extra_fee, service_unit_price) | |
| POST | `/api/periods/{id}/calculate` | ACCOUNTANT | Trigger calc |
| POST | `/api/periods/{id}/approve` | ADMIN | |
| POST | `/api/periods/{id}/revert` | ADMIN | |
| POST | `/api/periods/{id}/close` | ADMIN | |
| GET | `/api/periods/{id}/review` | ADMIN, ACCOUNTANT | Summary cho UI review |

### EVN Invoices
| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/periods/{periodId}/evn-invoices` | ACCOUNTANT, ADMIN | |
| POST | `/api/periods/{periodId}/evn-invoices` | ACCOUNTANT | |
| PATCH | `/api/evn-invoices/{id}` | ACCOUNTANT (chỉ khi period OPEN/READING_DONE) | |
| DELETE | `/api/evn-invoices/{id}` | ACCOUNTANT (như trên) | |

### Meter Readings
| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/periods/{periodId}/readings` | METER_READER (own only nếu cấu hình thế), ACCOUNTANT, ADMIN | |
| PATCH | `/api/readings/{id}` | METER_READER (period status=OPEN) | Submit số đọc |
| POST | `/api/readings/{id}/photo` | METER_READER | Upload ảnh đồng hồ (multipart) |

### Bills
| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/periods/{periodId}/bills` | ADMIN, ACCOUNTANT | filter `?status=` |
| GET | `/api/bills/{id}` | ADMIN, ACCOUNTANT | |
| GET | `/api/bills/{id}/pdf` | ADMIN, ACCOUNTANT | Trả file PDF |
| GET | `/api/periods/{periodId}/bills/print-pack` | ADMIN | Trả PDF gộp |
| POST | `/api/bills/{id}/mark-sent` | ADMIN | Đánh dấu đã gửi Zalo |
| POST | `/api/bills/{id}/payments` | ADMIN, ACCOUNTANT | Ghi nhận thanh toán thủ công |

### Payments & Webhook
| Method | Path | Role | Mô tả |
|---|---|---|---|
| POST | `/api/webhooks/sepay` | API key (header `Authorization: Apikey ...`) | SePay webhook |
| GET | `/api/payments/unmatched` | ADMIN | Giao dịch chưa gán bill |
| POST | `/api/payments/{id}/assign` | ADMIN | Gán manual giao dịch lạc vào 1 bill |

### Reports
| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/reports/debt` | ADMIN, ACCOUNTANT | Công nợ hiện tại |
| GET | `/api/reports/period-summary/{periodId}` | ADMIN, ACCOUNTANT | Tổng kết kỳ |

### Settings
| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/settings` | ADMIN | Danh sách setting |
| PATCH | `/api/settings/{key}` | ADMIN | Update value |

---

## 9. SePay webhook integration

### 9.1. Setup (one-time)

1. Đăng ký tài khoản tại my.sepay.vn
2. Liên kết TPBank theo hướng dẫn API Banking (online 100%)
3. Tạo API Token tại my.sepay.vn → API Access
4. Vào WebHook → Thêm webhook:
   - URL: `https://{your-domain}/api/webhooks/sepay`
   - Auth: API Key — generate 1 secret, lưu vào env `SEPAY_WEBHOOK_SECRET`
   - Bank account: tài khoản TPBank thu tiền điện
   - Bỏ qua nếu không có code thanh toán: **NO** (vì có CK lạ vẫn cần lưu để ADMIN review)

### 9.2. Request format (SePay → backend)

```http
POST /api/webhooks/sepay
Authorization: Apikey {SEPAY_WEBHOOK_SECRET}
Content-Type: application/json

{
  "id": 92704,
  "gateway": "TPBank",
  "transactionDate": "2026-05-15 14:02:37",
  "accountNumber": "0123499999",
  "code": null,
  "content": "TIENDIEN 2026-05 ND001",
  "transferType": "in",
  "transferAmount": 1850926,
  "accumulated": 19077000,
  "subAccount": null,
  "referenceCode": "208V009252001511",
  "description": "..."
}
```

### 9.3. Response format (backend → SePay)

**Quan trọng:** SePay coi là THẤT BẠI nếu HTTP code không phải 2xx hoặc body không trả `{success: true}`. SePay sẽ retry theo cấu hình.

```json
HTTP 200 OK
{ "success": true }
```

### 9.4. Handler logic (pseudocode)

```java
@PostMapping("/api/webhooks/sepay")
@Transactional
public ResponseEntity<?> handleSepay(
    @RequestHeader("Authorization") String auth,
    @RequestBody SepayWebhookPayload payload
) {
    // 1. Auth
    if (!auth.equals("Apikey " + sepaySecret)) {
        return 401;
    }

    // 2. Only handle incoming transfers
    if (!"in".equals(payload.transferType)) {
        return ok({success: true});
    }

    // 3. Idempotency
    String txnId = String.valueOf(payload.id);
    if (paymentRepo.existsByBankTransactionId(txnId)) {
        return ok({success: true});
    }

    // 4. Parse payment code from content
    Pattern p = Pattern.compile("TIENDIEN\\s+(\\S+)\\s+(\\S+)", CASE_INSENSITIVE);
    Matcher m = p.matcher(payload.content);
    Bill bill = null;
    if (m.find()) {
        String periodCode = m.group(1);
        String customerCode = m.group(2);
        String paymentCode = "TIENDIEN " + periodCode + " " + customerCode;
        bill = billRepo.findByPaymentCode(paymentCode).orElse(null);
    }

    // 5. Persist payment
    Payment payment = new Payment();
    payment.setBillId(bill != null ? bill.getId() : null);
    payment.setAmount(payload.transferAmount);
    payment.setMethod(BANK_TRANSFER);
    payment.setPaidAt(payload.transactionDate);
    payment.setBankTransactionId(txnId);
    payment.setBankReferenceCode(payload.referenceCode);
    payment.setRawContent(payload.content);
    paymentRepo.save(payment);

    // 6. Update bill if matched
    if (bill != null) {
        bill.setPaidAmount(bill.getPaidAmount().add(payload.transferAmount));
        if (bill.getPaidAmount().compareTo(bill.getTotalAmount()) >= 0) {
            bill.setStatus(PAID);
        } else {
            bill.setStatus(PARTIAL);
        }
        billRepo.save(bill);
    }

    // 7. Audit log
    auditLog.record(...);

    return ok({success: true});
}
```

### 9.5. Whitelist IP (optional, recommended)

SePay public IP list xem tại docs.sepay.vn. Cấu hình firewall hoặc reverse proxy chỉ cho phép các IP này gọi `/api/webhooks/sepay`.

---

## 10. PDF & VietQR generation

### 10.1. PDF hóa đơn

**Library:** OpenPDF (Apache 2.0, free hoàn toàn) — fork của iText 4.

**Layout (A5 portrait, vừa 1 trang):**
```
┌──────────────────────────────────────────┐
│         HÓA ĐƠN TIỀN ĐIỆN                │
│         Kỳ: Tháng 5/2026                  │
├──────────────────────────────────────────┤
│ Khách hàng: Đinh Chí Đệ        Mã: ND001 │
│ Số ĐT: 0xxx                               │
├──────────────────────────────────────────┤
│ Chỉ số cũ:           1,234                │
│ Chỉ số mới:          1,539                │
│ Tiêu thụ:              305 kWh            │
│                                           │
│ Đơn giá điện:    1,566 đ/kWh             │
│ Tiền điện:                  477,630 đ     │
│ Tiền công:                   30,500 đ     │
│ ────────────────────────────────────────  │
│ TỔNG CỘNG:                  508,130 đ     │
├──────────────────────────────────────────┤
│  ┌──────────┐                             │
│  │          │   Quét QR để CK              │
│  │ VietQR   │   TPBank - {acc_no}          │
│  │          │   {acc_holder}               │
│  └──────────┘   Nội dung:                 │
│                  TIENDIEN 2026-05 ND001  │
├──────────────────────────────────────────┤
│  Ngày phát hành: 30/04/2026               │
│  Hạn thanh toán: 30/05/2026               │
└──────────────────────────────────────────┘
```

### 10.2. VietQR

**Cách dễ nhất:** dùng API miễn phí của img.vietqr.io hoặc tự generate theo chuẩn EMVCo VietQR.

URL pattern (img.vietqr.io):
```
https://img.vietqr.io/image/{BANK_BIN}-{ACCOUNT_NO}-{TEMPLATE}.png
  ?amount={AMOUNT}
  &addInfo={URL_ENCODED_PAYMENT_CODE}
  &accountName={URL_ENCODED_NAME}
```

- `BANK_BIN` cho TPBank: `970423`
- `TEMPLATE`: `compact2` (có chứa thông tin)

Backend job (chạy khi period APPROVED):
```java
for each bill in period.bills:
    String qrUrl = vietQrService.build(
        TPBANK_BIN,
        accountNo,
        accountHolder,
        bill.totalAmount,
        bill.paymentCode  // "TIENDIEN 2026-05 ND001"
    );
    // download PNG, lưu vào local /uploads/qr/{bill.id}.png
    // hoặc lưu URL trực tiếp (nếu trust img.vietqr.io)
    bill.setQrCodeUrl(qrUrl);

    String pdfPath = pdfService.generate(bill);
    bill.setPdfUrl(pdfPath);
```

### 10.3. Print-pack

Endpoint `/api/periods/{id}/bills/print-pack` merge tất cả PDF của period thành 1 file:

```java
PdfCopy copy = new PdfCopy(...);
for (bill : period.bills) {
    PdfReader reader = new PdfReader(bill.pdfUrl);
    copy.addDocument(reader);
}
copy.close();
```

ADMIN tải về, in 2 mặt A4 (mỗi mặt 2 hóa đơn A5).

---

## 11. Zalo notification (MVP — bán tự động)

### 11.1. Vì sao không tự động hoàn toàn

- Zalo không có API chính thức cho tin nhắn cá nhân.
- Zalo OA cần đăng ký, ZNS tốn ~250-500đ/tin (100 KH/tháng = 25-50k/tháng) — đẩy sang sprint sau.
- Unofficial libraries (zCA-js) có rủi ro Zalo khóa account.

### 11.2. UX bán tự động

Tại trang `/periods/{id}/dispatch`, hiển thị grid 100 KH:

| KH | SĐT | Total | QR | [Gửi Zalo] | Status |
|---|---|---|---|---|---|
| Đinh Chí Đệ | 0xxx | 508,130 | ✓ | [Gửi] | — |
| Năm Công | 0yyy | 230,000 | ✓ | [Gửi] | ✓ Đã gửi |

Bấm `[Gửi]`:
1. Frontend tạo URL: `https://zalo.me/{phone}?text={encodeURIComponent(template)}`
2. `window.open(url)` → mở Zalo (web/app) với tin nhắn pre-fill
3. ADMIN bấm Send trong Zalo
4. Quay lại trang, frontend tự `POST /api/bills/{id}/mark-sent`
5. Status cột cuối thành "✓ Đã gửi"

Template tin nhắn:
```
Chào {name},
Hóa đơn tiền điện kỳ {period_name}:
  Tiêu thụ: {consumption} kWh
  Tổng: {total_amount_formatted} đ

Quý khách có thể:
1. Quét QR đính kèm để chuyển khoản tự động
2. Hoặc CK tay: TPBank - {acc_no} - {acc_holder}
   Nội dung: {payment_code}
3. Hoặc thanh toán tiền mặt khi nhận hóa đơn giấy.

Hạn thanh toán: {due_date}
Cảm ơn quý khách!
```

QR đính kèm: ADMIN dán ảnh QR thủ công (đã có sẵn trong PDF) — hoặc ở phase 2 dùng Zalo OA gửi luôn ảnh.

---

## 12. Audit log

Mọi action sau đây tạo audit_log entry:

- Login / logout
- Create / update / delete customer
- Create / update period; calculate; approve; revert; close
- Create / update / delete evn_invoice
- Create / update meter_reading (với `before` snapshot)
- Create payment (auto từ webhook hoặc manual)
- Update setting

`before_value` và `after_value` lưu JSON đầy đủ entity tại 2 thời điểm. UI cho ADMIN có trang `/audit` xem log với filter theo entity, user, time range.

---

## 13. Acceptance criteria (Definition of Done MVP)

Hệ thống được coi là "thay thế được Excel hiện tại" khi:

1. ✅ ADMIN tạo period, METER_READER nhập 100 chỉ số qua điện thoại trong < 30 phút
2. ✅ ACCOUNTANT nhập EVN invoice + bấm calculate → có 100 bill với số tiền chính xác đối chiếu công thức Excel cũ (sai lệch ≤ 1đ do rounding)
3. ✅ ADMIN review thấy summary đầy đủ (tổng EVN, đơn giá, chênh lệch), revert/approve hoạt động
4. ✅ Sau approve: 100 PDF có VietQR sinh tự động, ADMIN tải print-pack in được
5. ✅ Khách CK qua VietQR → SePay webhook → bill chuyển PAID trong < 30 giây
6. ✅ Khách CK với nội dung sai → giao dịch lưu vào "unmatched", ADMIN gán thủ công được
7. ✅ ACCOUNTANT thử bấm approve → bị 403; thử sửa bill sau khi APPROVED → bị 403
8. ✅ Báo cáo công nợ list đúng các bill chưa PAID
9. ✅ Audit log ghi đầy đủ action quan trọng
10. ✅ Backup MySQL hàng ngày, có thể restore

---

## 14. Roadmap (4 sprint × 2 tuần)

| Sprint | Deliverables |
|---|---|
| **S1** | Auth + Customer CRUD + Period CRUD + Meter reading flow (web responsive). User test: METER_READER nhập đủ 100 số đo. |
| **S2** | EVN Invoice + Calculation + Review/Approve workflow + Audit log. User test: chạy lại 1 kỳ Excel cũ, đối chiếu kết quả. |
| **S3** | PDF + VietQR + Zalo deeplink + Print pack + Mark sent. User test: phát hành 1 kỳ thật, in giao 50 hộ, gửi Zalo 50 hộ. |
| **S4** | SePay webhook + Auto matching + Manual assign + Debt report. User test: end-to-end 1 kỳ thật, đo % giao dịch tự động khớp. |

---

## 15. Open questions / future work

- **Phase 2 — Zalo OA**: khi ổn định thì đăng ký OA, dùng ZNS template để gửi auto.
- **Phase 2 — Mobile-first cho METER_READER**: PWA hoặc app native (React Native / Flutter), hỗ trợ offline + chụp ảnh đồng hồ tự nhận diện số (OCR).
- **Phase 2 — Multi-meter per customer**: nếu có khách dùng 2 đồng hồ.
- **Phase 2 — Customer self-service portal**: KH tự xem lịch sử, hóa đơn online.
- **Cần làm rõ:** chính sách phạt nộp muộn? Có giảm trừ khi KH dùng đúng giờ thấp điểm không? (Hiện chưa thấy trong file Excel cũ.)

---

## Appendix A — Sample period data flow (từ Excel kỳ T4+5/2013)

| Step | Data | Status |
|---|---|---|
| 1. ADMIN tạo period "Tháng 4+5/2013" | start=2013-04-01, end=2013-05-31, service=100 | OPEN |
| 2. METER_READER nhập 23 số đọc | total = 4,819 kWh | READING_DONE |
| 3. ACCOUNTANT nhập 2 EVN invoices | 5,394,850 + 1,974,460 + extra 177,109 = 7,546,419 | READING_DONE |
| 4. ACCOUNTANT bấm Calculate | unit_price = 1,566 → tạo 23 bills | CALCULATED |
| 5. ADMIN review: tổng total = 7,546,419 ± rounding | OK | CALCULATED |
| 6. ADMIN bấm Approve | gen 23 PDF + 23 QR | APPROVED |
| 7. ADMIN in print-pack, gửi Zalo | bill status SENT | APPROVED |
| 8. KH CK dần qua VietQR | bill PAID dần | APPROVED |
| 9. Sau 30 ngày, ADMIN close | period.status = CLOSED | CLOSED |
