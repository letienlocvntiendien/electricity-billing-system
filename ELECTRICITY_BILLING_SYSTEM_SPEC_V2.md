# Electricity Billing System — MVP Specification

**Version:** 2.0
**Last updated:** 2026-05-02
**Owner:** Lộc
**Stack:** Spring Boot 3 + Java 21 + MySQL 8 + React 19 + Tailwind

**Changelog v2.0:**
- EVN invoice tách break-down theo 3 loại biểu giá: Bình thường, Cao điểm, Thấp điểm
- Đổi mô hình tiền công: từ đơn giá đ/kWh → **phí cố định mỗi hộ mỗi kỳ** (flat fee)
- Cả ACCOUNTANT và ADMIN đều nhập được EVN invoice
- Bỏ auto-transition `OPEN → READING_DONE` — thay bằng explicit submit của METER_READER
- Thêm sub-state "ACCOUNTANT đã đối chiếu hóa đơn EVN" trước khi ADMIN approve được
- Section 6 viết lại với format Input → Process → Output cho từng công thức và biến số liệu
- Đổi worked example sang số liệu thực tế của Lộc (kỳ T5/2026)

---

## 1. Tổng quan

Hệ thống thay thế quy trình tính tiền điện bằng giấy + Excel + tool Java rời rạc hiện tại. Mô hình kinh doanh là **đồng hồ tổng (EVN) → đồng hồ con (~100 hộ)**: chủ ký 1 hợp đồng với EVN, đọc đồng hồ con từng hộ, chia tiền hóa đơn EVN theo tỷ lệ tiêu thụ, cộng thêm phí ghi điện cố định, sau đó phát hóa đơn và thu tiền.

EVN tính tiền chủ theo **biểu giá 3 thời điểm (TOU — Time of Use)**: Bình thường, Cao điểm, Thấp điểm. Tuy nhiên hệ thống nội bộ **không phân biệt 3 loại này khi tính cho từng hộ** — chỉ track break-down của hóa đơn EVN cho minh bạch và đối chiếu. Các hộ vẫn trả theo **một đơn giá tổng hợp duy nhất** tính từ tổng EVN ÷ tổng kWh tiêu thụ.

### 1.1. Phạm vi MVP

**Trong scope:**
- Quản lý ~100 khách hàng (CRUD)
- Tạo kỳ tính tiền linh hoạt (1 tháng hoặc liên tục nhiều tháng)
- Nhập chỉ số đồng hồ qua web (responsive cho mobile)
- Nhập hóa đơn EVN với break-down 3 thời điểm
- Tính đơn giá tự động + phí ghi điện cố định
- Workflow review/approve có sub-state giám sát của kế toán
- Sinh PDF hóa đơn + VietQR
- In hàng loạt cho khách thanh toán tiền mặt
- SePay webhook → auto gạch nợ chuyển khoản TPBank
- Zalo deeplink (bán tự động) thông báo
- Báo cáo công nợ cơ bản
- Audit log mọi thao tác trên dữ liệu tiền

**Ngoài scope MVP (xét sau):**
- Phụ phí khác (thí nghiệm, kiểm định, bảo trì) — section 6 hiện tại đã có chỗ dành sẵn (`extra_fee = 0` mặc định)
- Mobile app native
- Zalo OA / ZNS
- Đa hợp đồng EVN / đa khu vực
- Báo cáo nâng cao (biểu đồ xu hướng, phân tích)
- Đồng bộ với accounting software
- Multi-tenant
- Track VAT riêng (hiện chỉ lưu tổng tiền đã bao gồm VAT)

---

## 2. Thuật ngữ

| Thuật ngữ | Định nghĩa |
|---|---|
| **EVN invoice** | Hóa đơn điện tử/giấy mà EVN gửi cho chủ (đồng hồ tổng) |
| **TOU (Time of Use)** | Biểu giá EVN 3 thời điểm: Normal / Peak / Off-peak |
| **Meter reading** | Lần đọc đồng hồ con của 1 khách hàng trong 1 kỳ |
| **Billing period** | Kỳ tính tiền (thường 1 tháng, có thể 2-3 tháng liên tục) |
| **Bill** | Hóa đơn cho 1 khách hàng trong 1 kỳ |
| **Unit price** (`unit_price`) | Đơn giá điện tổng hợp đ/kWh, tính từ tổng EVN ÷ tổng kWh tiêu thụ thực tế các hộ |
| **Service fee** (`service_fee`) | **Phí ghi điện cố định mỗi hộ mỗi kỳ** (đồng, không nhân kWh) |
| **Hao hụt** | Chênh lệch giữa kWh đo trên đồng hồ tổng (EVN) và tổng kWh đo trên đồng hồ con. Hấp thụ tự động vào `unit_price` (các hộ gánh chung) |
| **Payment code** | Chuỗi định danh dùng trong nội dung CK để SePay tự match |

---

## 3. User & phân quyền

3 vai trò, không trùng:

| Role | Capability |
|---|---|
| **METER_READER** | Tạo/cập nhật `meter_reading` ở period status=`OPEN`. **Phải explicit submit** khi hoàn thành (không tự động). Không xem được dữ liệu tài chính, không thấy tab Hóa đơn EVN. |
| **ACCOUNTANT** | Tạo/cập nhật `evn_invoice` (xem tab Hóa đơn EVN). Override `service_fee`. Trigger calculation. **Bắt buộc đối chiếu (verify)** trước khi ADMIN approve. **KHÔNG** approve được. **KHÔNG** sửa sau khi approved. |
| **ADMIN** | Toàn quyền. Cũng nhập được EVN invoice (xem tab Hóa đơn EVN). Là người duy nhất approve được period. Quản lý user, customer, settings. |

**Nguyên tắc bất biến:**
- Sau khi `billing_period.status = APPROVED`, không user nào sửa được dữ liệu của period đó (kể cả ADMIN). Muốn sửa phải explicit `revert` về `OPEN`, hành động này được audit log.
- Tất cả write action quan trọng (tạo/sửa reading, EVN invoice, calculate, verify, approve, mark paid) → ghi `audit_log`.
- ADMIN không thể approve nếu ACCOUNTANT chưa verify (cơ chế 4-eyes review).

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
| evn_total_amount | DECIMAL(15,2) | Tổng từ tất cả `evn_invoice` của kỳ (cache, derive từ peak+normal+off_peak) |
| evn_total_kwh | INT | Tổng kWh từ EVN (cache, derive từ peak+normal+off_peak) |
| extra_fee | DECIMAL(15,2) DEFAULT 0 | Phụ phí ngoài hóa đơn EVN — **MVP để mặc định 0**, dành cho phase 2 |
| service_fee | DECIMAL(15,2) | **Phí ghi điện cố định/hộ/kỳ**, default từ `system_setting`, override được mỗi kỳ |
| unit_price | DECIMAL(10,2) | Đơn giá điện tổng hợp, tính sau khi calculate |
| status | ENUM | `OPEN` → `READING_DONE` → `CALCULATED` → `APPROVED` → `CLOSED` |
| accountant_verified_by | BIGINT FK user | Kế toán đã đối chiếu hóa đơn EVN |
| accountant_verified_at | TIMESTAMP NULL | |
| approved_by | BIGINT FK user | |
| approved_at | TIMESTAMP NULL | |
| closed_at | TIMESTAMP NULL | |

#### `evn_invoice`
Hóa đơn EVN nhập tay, có break-down theo 3 thời điểm. 1 kỳ có 1-N hóa đơn.

| Field | Type | Note |
|---|---|---|
| id | BIGINT PK | |
| period_id | BIGINT FK | |
| invoice_date | DATE | |
| invoice_number | VARCHAR(50) | |
| normal_kwh | INT | kWh giờ Bình thường |
| normal_amount | DECIMAL(15,2) | Tiền giờ Bình thường |
| peak_kwh | INT | kWh giờ Cao điểm |
| peak_amount | DECIMAL(15,2) | Tiền giờ Cao điểm |
| off_peak_kwh | INT | kWh giờ Thấp điểm |
| off_peak_amount | DECIMAL(15,2) | Tiền giờ Thấp điểm |
| kwh | INT GENERATED | `normal_kwh + peak_kwh + off_peak_kwh` (STORED) |
| amount | DECIMAL(15,2) GENERATED | `normal_amount + peak_amount + off_peak_amount` (STORED) |
| attachment_url | VARCHAR(500) | ảnh hóa đơn (S3/local), optional |
| created_by | BIGINT FK user | ACCOUNTANT hoặc ADMIN |

**Note:** Số tiền các loại đã bao gồm VAT. Hệ thống không tách VAT riêng.

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
| service_fee | DECIMAL(15,2) | snapshot từ period.service_fee |
| electricity_amount | DECIMAL(15,2) | `consumption × unit_price` |
| service_amount | DECIMAL(15,2) | **= service_fee** (cố định, không nhân consumption) |
| total_amount | DECIMAL(15,2) | `electricity_amount + service_amount` |
| paid_amount | DECIMAL(15,2) | tổng `payment.amount` đã match |
| status | ENUM | `PENDING` → `SENT` → `PARTIAL` / `PAID` / `OVERDUE` |
| payment_code | VARCHAR(50) UNIQUE | Format: `TIENDIEN {period_code} {customer_code}` |
| qr_code_url | VARCHAR(500) | |
| pdf_url | VARCHAR(500) | |
| sent_via_zalo | BOOLEAN | đánh dấu đã bấm gửi Zalo |
| sent_at | TIMESTAMP NULL | |

**Vì sao snapshot `unit_price` và `service_fee` vào `bill`:** Nếu sau này admin lỡ tay sửa `billing_period` (dù workflow chặn nhưng phòng hờ), số tiền trên bill đã in/gửi cho khách không bị thay đổi.

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
| `default_service_fee` | "10000" | **Phí ghi điện cố định mặc định (đ/hộ/kỳ)** |
| `payment_code_prefix` | "TIENDIEN" | Prefix cho mã thanh toán |
| `bank_account_number` | "" | TK TPBank nhận tiền |
| `bank_account_holder` | "" | Chủ TK |
| `bank_bin_tpbank` | "970423" | Mã BIN ngân hàng TPBank cho VietQR |
| `overdue_days` | "30" | Số ngày sau APPROVED chuyển bill thành OVERDUE |
| `reading_anomaly_threshold` | "300" | Cảnh báo nếu consumption lệch >X% so với TB 3 kỳ trước |
| `loss_warning_threshold` | "15" | Cảnh báo nếu hao hụt > X% so với tổng EVN |

#### `audit_log`
Mọi mutation quan trọng. JSON before/after.

---

## 5. State machines

### 5.1. `billing_period.status`

```
                  ┌────────────────────── revert (ADMIN) ──────┐
                  ▼                                            │
    ┌──────────┐                  ┌──────────────┐            │
    │   OPEN   │ submit-readings  │ READING_DONE │            │
    │          │─────────────────►│              │            │
    └──────────┘ (METER_READER)   └──────┬───────┘            │
                                         │ calculate          │
                                         │ (ACCOUNTANT/ADMIN) │
                                         ▼                    │
                                  ┌──────────────┐            │
                                  │ CALCULATED   │            │
                                  │              │            │
                                  │ + verify     │            │
                                  │ (ACCOUNTANT) │            │
                                  └──────┬───────┘            │
                                         │ approve (ADMIN)    │
                                         │ ONLY IF verified   │
                                         ▼                    │
   ┌──────────┐  close (ADMIN)    ┌──────────┐                │
   │  CLOSED  │◄──────────────────│ APPROVED │────────────────┘
   └──────────┘                   └──────────┘
                          (no further edits)
```

**Transitions:**

| From | To | Action | Role | Side effects |
|---    |---|---|---|---|
| `-` | `OPEN` | Create period | ADMIN | Auto-clone customer list, init `meter_reading` rows với `previous_index` = current_index kỳ trước |
| `OPEN` | `READING_DONE` | **Explicit submit** | METER_READER | Confirm modal trên UI; sau bước này METER_READER không sửa được |
| `READING_DONE` | `CALCULATED` | Calculate bills | ACCOUNTANT/ADMIN | Tính `unit_price`, tạo N `bill` records |
| `CALCULATED` | `CALCULATED + verified` | Verify EVN | ACCOUNTANT | Set `accountant_verified_at`. Không transition status, chỉ enable nút Approve |
| `CALCULATED` | `OPEN` | Revert | ADMIN | Xóa toàn bộ `bill` của period; clear verified |
| `CALCULATED + verified` | `APPROVED` | Approve | ADMIN | Lock period; sinh PDF + QR cho từng bill |
| `APPROVED` | `OPEN` | Revert | ADMIN | Hiếm dùng; xóa bill, PDF, QR; clear verified và approved |
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

## 6. Calculation Reference (chi tiết Input → Process → Output)

Section này là **single source of truth** cho mọi công thức và biến số liệu trong hệ thống. Mỗi mục có Input rõ ràng (lấy từ đâu), Process (cách tính), Output (lưu ở đâu).

### 6.1. Tổng kWh tiêu thụ thực tế từ đồng hồ con

| | |
|---|---|
| **Tên biến** | `total_actual_consumption` |
| **Đơn vị** | kWh (số nguyên) |
| **Input** | Tất cả `meter_reading.consumption` của period, với customer.active = true |
| **Process** | `SUM(meter_reading.consumption) WHERE meter_reading.period_id = ?` |
| **Output** | Hiển thị ở Review screen. Không lưu vào DB (derive on-the-fly). |
| **Khi nào tính** | Real-time trên Review screen. Cũng tính tại bước Calculate. |
| **Ví dụ** | 37,693 kWh (số liệu thực kỳ T5/2026 của Lộc) |

### 6.2. Tổng kWh từ EVN

| | |
|---|---|
| **Tên biến** | `evn_total_kwh` |
| **Đơn vị** | kWh (số nguyên) |
| **Input** | Tất cả `evn_invoice` của period |
| **Process** | `SUM(evn_invoice.normal_kwh + evn_invoice.peak_kwh + evn_invoice.off_peak_kwh)` |
| **Output** | Lưu vào `billing_period.evn_total_kwh` (cache) khi calculate. |
| **Khi nào tính** | Khi ACCOUNTANT/ADMIN nhập EVN invoice và bấm Calculate. |
| **Ví dụ** | 26,413 + 9,122 + 5,989 = **41,524 kWh** |

### 6.3. Tổng tiền EVN

| | |
|---|---|
| **Tên biến** | `evn_total_amount` |
| **Đơn vị** | đồng (đã bao gồm VAT) |
| **Input** | Tất cả `evn_invoice` của period |
| **Process** | `SUM(evn_invoice.normal_amount + evn_invoice.peak_amount + evn_invoice.off_peak_amount)` |
| **Output** | Lưu vào `billing_period.evn_total_amount` (cache) khi calculate. |
| **Khi nào tính** | Khi calculate. |
| **Ví dụ** | 100,950,204 đ |

### 6.4. Hao hụt

| | |
|---|---|
| **Tên biến** | `loss_kwh`, `loss_percentage` |
| **Đơn vị** | kWh; % |
| **Input** | `evn_total_kwh`, `total_actual_consumption` (mục 6.1, 6.2) |
| **Process** | `loss_kwh = evn_total_kwh - total_actual_consumption`<br>`loss_percentage = loss_kwh / evn_total_kwh × 100` |
| **Output** | Hiển thị ở Review screen với badge cảnh báo nếu vượt `loss_warning_threshold` (default 15%). Không lưu DB. |
| **Khi nào tính** | Real-time trên Review screen. |
| **Ví dụ** | 41,524 − 37,693 = **3,831 kWh (9.2%)** ✅ trong ngưỡng |

**Ý nghĩa:** Hao hụt là phần điện đo trên đồng hồ tổng EVN nhưng không đo được trên đồng hồ con (do tổn thất đường dây, sai số đồng hồ). Phần này được hấp thụ tự động vào `unit_price` — các hộ gánh chung.

### 6.5. Đơn giá điện tổng hợp

| | |
|---|---|
| **Tên biến** | `unit_price` |
| **Đơn vị** | đ/kWh (DECIMAL 10,2) |
| **Input** | `evn_total_amount` (6.3), `total_actual_consumption` (6.1), `extra_fee` (từ period, MVP = 0) |
| **Process** | `unit_price = (evn_total_amount + extra_fee) / total_actual_consumption`<br>Làm tròn 2 chữ số thập phân (dùng `BigDecimal.ROUND_HALF_UP`) |
| **Output** | Lưu vào `billing_period.unit_price` khi calculate. Snapshot vào `bill.unit_price` cho từng bill. |
| **Khi nào tính** | Khi ACCOUNTANT/ADMIN bấm Calculate. |
| **Ví dụ** | 100,950,204 / 37,693 = **2,678.49 đ/kWh** |
| **Edge case** | Nếu `total_actual_consumption = 0` → reject: "Tất cả KH đều có consumption=0, không thể tính đơn giá." |

### 6.6. Tiền điện cho từng hộ

| | |
|---|---|
| **Tên biến** | `bill.electricity_amount` |
| **Đơn vị** | đồng |
| **Input** | `meter_reading.consumption` của hộ, `unit_price` (6.5) |
| **Process** | `electricity_amount = consumption × unit_price`<br>Làm tròn đến đồng (DECIMAL 15,2 nhưng giá trị nguyên) |
| **Output** | Lưu vào `bill.electricity_amount`. |
| **Khi nào tính** | Khi calculate, cho từng bill. |
| **Ví dụ** | Hộ X dùng 200 kWh: 200 × 2,678.49 = **535,698 đ** |

### 6.7. Tiền công ghi điện cho từng hộ gia đình (phí cố định)

| | |
|---|---|
| **Tên biến** | `bill.service_amount` |
| **Đơn vị** | đồng |
| **Input** | `billing_period.service_fee` (snapshot từ system_setting hoặc override) |
| **Process** | `service_amount = service_fee` (gán trực tiếp, **không nhân consumption**) |
| **Output** | Lưu vào `bill.service_amount` và `bill.service_fee` (snapshot). |
| **Khi nào tính** | Khi calculate, cho từng bill. |
| **Ví dụ** | service_fee = 10,000 → mỗi hộ tính 10,000 đ |
| **Note quan trọng** | Hộ có `consumption = 0` vẫn tính `service_amount = service_fee` vì METER_READER vẫn phải đi đến đọc đồng hồ. Nếu muốn miễn → xét sau ở phase 2. |

### 6.8. Tổng cộng cho từng hộ

| | |
|---|---|
| **Tên biến** | `bill.total_amount` |
| **Đơn vị** | đồng |
| **Input** | `electricity_amount` (6.6), `service_amount` (6.7) |
| **Process** | `total_amount = electricity_amount + service_amount` |
| **Output** | Lưu vào `bill.total_amount`. Cũng dùng làm số tiền trên QR VietQR. |
| **Khi nào tính** | Khi calculate. |
| **Ví dụ** | 535,698 + 10,000 = **545,698 đ** |

### 6.9. Đối chiếu tổng (Reconciliation)

Hiển thị ở Review screen để ADMIN/ACCOUNTANT kiểm tra trước khi approve.

| | |
|---|---|
| **Sum of bills** | `Σ bill.total_amount` |
| **Expected** | `evn_total_amount + extra_fee + (số_hộ_active × service_fee)` |
| **Sai lệch (rounding)** | `expected - sum_of_bills` (thường ±vài đồng do rounding của unit_price) |

Nếu sai lệch > 100 đồng → cảnh báo nghiêm trọng (có lỗi logic). Sai lệch dưới 100 đồng là bình thường.

### 6.10. Worked example (kỳ T5/2026 thực tế của Lộc)

**Input:**
- 1 EVN invoice với break-down:
   - Bình thường: 26,413 kWh
   - Cao điểm: 9,122 kWh
   - Thấp điểm: 5,989 kWh
- Tổng tiền EVN: 100,950,204 đ
- `extra_fee = 0` (MVP)
- `service_fee = 10,000` đ/hộ
- 100 hộ active, tổng `consumption` thực tế: 37,693 kWh
- Hộ "Đinh Chí Đệ" có consumption = 305 kWh (giả sử)

**Tính:**
```
evn_total_kwh    = 26,413 + 9,122 + 5,989 = 41,524 kWh
loss_kwh         = 41,524 - 37,693         = 3,831 kWh
loss_percentage  = 3,831 / 41,524 × 100    ≈ 9.2%

unit_price       = 100,950,204 / 37,693     = 2,678.49 đ/kWh

Bill cho Đinh Chí Đệ:
  electricity_amount = 305 × 2,678.49      = 816,939 đ
  service_amount     = 10,000              = 10,000 đ
  total_amount                              = 826,939 đ
```

**Reconciliation:**
```
Sum of all bills:
  Σ electricity_amount = Σ (consumption_i × 2,678.49)
                       = 2,678.49 × Σ consumption_i
                       = 2,678.49 × 37,693
                       = 100,950,191.57
                       ≈ 100,950,192 (sau rounding cộng dồn)
  Σ service_amount     = 100 × 10,000      = 1,000,000

  Total                                     = 101,950,192

Expected:
  evn_total_amount + 100 × service_fee
  = 100,950,204 + 1,000,000               = 101,950,204

Sai lệch: 101,950,204 - 101,950,192 = 12 đồng (rounding) ✅
```

### 6.11. Rounding policy (tổng hợp)

| Biến | Precision | Rounding |
|---|---|---|
| `unit_price` | DECIMAL(10,2) | HALF_UP đến 2 chữ số thập phân |
| `electricity_amount` | DECIMAL(15,2) | HALF_UP đến đồng (0 chữ số thập phân) |
| `service_amount` | DECIMAL(15,2) | Không rounding (giữ nguyên service_fee) |
| `total_amount` | DECIMAL(15,2) | Không rounding (cộng 2 con số đã rounding) |
| Hiển thị UI | — | Format `#,##0 đ` (VN locale) |

### 6.12. Edge cases

| Case | Xử lý |
|---|---|
| `total_actual_consumption = 0` | Reject calculation. "Tất cả KH đều có consumption=0, không thể tính đơn giá." |
| 1 KH có `consumption = 0` | Bill vẫn tạo. `electricity_amount = 0`, `service_amount = service_fee`, `total_amount = service_fee`. Status = `PENDING` (vẫn phải thu tiền công). |
| KH mới gia nhập giữa kỳ | Tạo customer với `previous_index = current_index` của lần đọc đầu → consumption = 0 cho kỳ join. Kỳ sau bình thường. |
| KH cũ ngừng dùng | Set `customer.active = false`. Period mới không tự tạo `meter_reading` cho KH này. |
| Đồng hồ bị thay (reset về 0) | METER_READER nhập `current_index = 0` → consumption âm → CHECK constraint fail. Workaround: ADMIN edit `previous_index = 0` cho riêng row đó, ghi notes vào audit. |
| Hao hụt > 15% | Cảnh báo đỏ ở Review screen. Không block calculate, nhưng buộc ADMIN/ACCOUNTANT chú ý. |

---

## 7. Core workflows

### 7.1. Tạo kỳ và đọc đồng hồ

```
ADMIN: POST /api/periods
  body: { name, start_date, end_date, service_fee? }
  → tạo period status=OPEN
  → service_fee default lấy từ system_setting.default_service_fee, override được
  → background job clone meter_reading template cho mọi customer.active=true,
    auto-fill previous_index từ kỳ trước (hoặc 0 nếu KH mới)

METER_READER (mobile-friendly web):
  GET /api/periods/current/readings → list 100 readings (chưa nhập)
  PATCH /api/readings/{id} { current_index, photo_url } → save từng cái
  → progress bar trên UI: "85/100 đã nhập"
  → KHÔNG auto transition khi đủ 100/100

  Khi xong, METER_READER bấm nút [Hoàn thành kỳ này]:
    → frontend hiện modal:
       "Bạn đã nhập 100/100 chỉ số. Xác nhận hoàn thành kỳ này?
        Sau khi xác nhận, bạn KHÔNG sửa được nữa.
        Số liệu sẽ chuyển cho kế toán/admin."
    → 2 nút: [Tôi muốn kiểm tra lại] [Xác nhận hoàn tất]

  Nếu confirm: POST /api/periods/{id}/submit-readings
    → period.status = OPEN → READING_DONE
    → audit_log: "METER_READER X submitted readings at Y"
```

### 7.2. Nhập hóa đơn EVN (tab Hóa đơn EVN)

Tab này CHỈ hiển thị cho ACCOUNTANT và ADMIN. METER_READER không thấy.

```
ACCOUNTANT hoặc ADMIN:
  Vào tab "Hóa đơn EVN" của period.

  POST /api/periods/{id}/evn-invoices
    body: {
      invoice_date, invoice_number,
      normal_kwh, normal_amount,
      peak_kwh, peak_amount,
      off_peak_kwh, off_peak_amount,
      attachment_url?
    }
    → kwh và amount tự sinh (generated columns)
    → audit_log

  Có thể PATCH/DELETE khi period.status IN (OPEN, READING_DONE)
  Sau CALCULATED → readonly (vì đã dùng để tính bill)
```

### 7.3. Tính tiền

```
ACCOUNTANT hoặc ADMIN:
  Vào period (status=READING_DONE)
  Có thể PATCH /api/periods/{id} { extra_fee?, service_fee? } để override
  POST /api/periods/{id}/calculate
    → server validate:
       - period.status = READING_DONE
       - có ít nhất 1 evn_invoice
       - total_actual_consumption > 0
    → server tính theo §6:
       evn_total_amount, evn_total_kwh
       unit_price = (evn_total_amount + extra_fee) / total_actual_consumption
    → tạo N bill rows với snapshot unit_price, service_fee
    → period.status = CALCULATED
    → audit_log
```

### 7.4. Review và approve (4-eyes)

```
[Bước 1: ACCOUNTANT đối chiếu]
ACCOUNTANT vào GET /api/periods/{id}/review
  → Xem bảng tổng hợp:
     - Tổng EVN (3 loại): 26,413 + 9,122 + 5,989 = 41,524 kWh / 100,950,204 đ
     - Tổng đồng hồ con: 37,693 kWh
     - Hao hụt: 3,831 kWh (9.2%) ✅
     - Đơn giá: 2,678.49 đ/kWh
     - Tiền công: 10,000 đ/hộ × 100 hộ = 1,000,000 đ
     - Tổng các bill: 101,950,192 đ (sai lệch 12đ rounding)
     - Danh sách 100 bill chi tiết
  → Bấm checkbox "✓ Tôi đã đối chiếu hóa đơn EVN với hệ thống"
  → POST /api/periods/{id}/verify
    → period.accountant_verified_by = current_user
    → period.accountant_verified_at = NOW()

[Bước 2: ADMIN review và approve]
ADMIN vào /periods/{id}/review
  → Xem cùng dashboard
  → Thấy banner: "✅ Kế toán Nguyễn Văn X đã đối chiếu lúc 14:30 ngày 02/05/2026"
  → Có 2 nút:
     [Yêu cầu sửa] → POST /api/periods/{id}/revert
                   → status = OPEN, xóa bills, clear verified
     [Duyệt phát hành] → POST /api/periods/{id}/approve
                       → REQUIRE: period.accountant_verified_at IS NOT NULL
                       → status = APPROVED
                       → background job: gen PDF + VietQR cho mọi bill
                       → bill.status = SENT khi PDF sẵn sàng

  Nếu ACCOUNTANT chưa verify → nút Approve disabled, tooltip:
  "Cần kế toán đối chiếu hóa đơn EVN trước"
```

### 7.5. Phát hành & gửi thông báo

```
ADMIN bấm "In hàng loạt":
  GET /api/periods/{id}/bills/print-pack
  → server merge tất cả PDF → trả 1 file PDF lớn (mỗi bill 1 trang A5/A4)
  → ADMIN tải về, in, đi giao tận tay (cho khách tiền mặt)

ADMIN bấm "Gửi Zalo":
  GET /api/periods/{id}/bills?status=SENT
  → frontend render mỗi bill thành 1 button
  → click → mở zalo.me/{phone}?text={template}
  → ADMIN ấn Send trong app Zalo
  → frontend mark sent_via_zalo = true
```

### 7.6. Thu tiền (auto + manual)

(Không đổi so với v1.0 — xem section 9 SePay webhook integration)

---

## 8. REST API

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
| PATCH | `/api/periods/{id}` | ACCOUNTANT, ADMIN (chỉ extra_fee, service_fee, ở status OPEN/READING_DONE) | |
| POST | `/api/periods/{id}/submit-readings` | METER_READER | OPEN → READING_DONE (explicit) |
| POST | `/api/periods/{id}/calculate` | ACCOUNTANT, ADMIN | Trigger calc |
| POST | `/api/periods/{id}/verify` | ACCOUNTANT | Đánh dấu đã đối chiếu |
| POST | `/api/periods/{id}/approve` | ADMIN | Yêu cầu period.verified |
| POST | `/api/periods/{id}/revert` | ADMIN | Về OPEN, xóa bill + verify |
| POST | `/api/periods/{id}/close` | ADMIN | |
| GET | `/api/periods/{id}/review` | ADMIN, ACCOUNTANT | Summary cho UI review |

### EVN Invoices (tab Hóa đơn EVN)
| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/periods/{periodId}/evn-invoices` | ACCOUNTANT, ADMIN | |
| POST | `/api/periods/{periodId}/evn-invoices` | **ACCOUNTANT, ADMIN** | |
| PATCH | `/api/evn-invoices/{id}` | **ACCOUNTANT, ADMIN** (chỉ khi period OPEN/READING_DONE) | |
| DELETE | `/api/evn-invoices/{id}` | **ACCOUNTANT, ADMIN** (như trên) | |

### Meter Readings
| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/periods/{periodId}/readings` | METER_READER, ACCOUNTANT, ADMIN | METER_READER thấy của mình |
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
  "transferAmount": 826939,
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
│ Đơn giá điện:    2,678.49 đ/kWh          │
│ Tiền điện:                  816,939 đ     │
│ Tiền công ghi điện:          10,000 đ     │
│ ────────────────────────────────────────  │
│ TỔNG CỘNG:                  826,939 đ     │
├──────────────────────────────────────────┤
│  ┌──────────┐                             │
│  │          │   Quét QR để CK              │
│  │ VietQR   │   TPBank - {acc_no}          │
│  │          │   {acc_holder}               │
│  └──────────┘   Nội dung:                 │
│                  TIENDIEN 2026-05 ND001  │
├──────────────────────────────────────────┤
│  Ngày phát hành: 02/05/2026               │
│  Hạn thanh toán: 01/06/2026               │
└──────────────────────────────────────────┘
```

**Lưu ý hiển thị:** PDF cho khách hàng dùng mô hình **đơn giản (A)** — chỉ 1 đơn giá tổng hợp. KHÔNG hiển thị break-down 3 loại Bình thường/Cao điểm/Thấp điểm cho khách (vì khách trả theo đơn giá trung bình, không cần biết chi tiết EVN).

### 10.2. VietQR

URL pattern (img.vietqr.io):
```
https://img.vietqr.io/image/{BANK_BIN}-{ACCOUNT_NO}-{TEMPLATE}.png
  ?amount={AMOUNT}
  &addInfo={URL_ENCODED_PAYMENT_CODE}
  &accountName={URL_ENCODED_NAME}
```

- `BANK_BIN` cho TPBank: `970423`
- `TEMPLATE`: `compact2` (có chứa thông tin)

### 10.3. Print-pack

(Không đổi so với v1.0)

---

## 11. Zalo notification (MVP — bán tự động)

### 11.1. Vì sao không tự động hoàn toàn

(Không đổi so với v1.0)

### 11.2. UX bán tự động

(Không đổi so với v1.0, chỉ update template tin nhắn)

Template tin nhắn:
```
Chào {name},
Hóa đơn tiền điện kỳ {period_name}:
  Tiêu thụ: {consumption} kWh
  Tiền điện: {electricity_amount_formatted} đ
  Tiền công ghi điện: {service_amount_formatted} đ
  Tổng: {total_amount_formatted} đ

Quý khách có thể:
1. Quét QR đính kèm để chuyển khoản tự động
2. Hoặc CK tay: TPBank - {acc_no} - {acc_holder}
   Nội dung: {payment_code}
3. Hoặc thanh toán tiền mặt khi nhận hóa đơn giấy.

Hạn thanh toán: {due_date}
Cảm ơn quý khách!
```

---

## 12. Audit log

Mọi action sau đây tạo audit_log entry:

- Login / logout
- Create / update / delete customer
- Create / update period; submit-readings; calculate; **verify**; approve; revert; close
- Create / update / delete evn_invoice (kèm role của người tạo: ACCOUNTANT hay ADMIN)
- Create / update meter_reading (với `before` snapshot)
- Create payment (auto từ webhook hoặc manual)
- Update setting

`before_value` và `after_value` lưu JSON đầy đủ entity tại 2 thời điểm. UI cho ADMIN có trang `/audit` xem log với filter theo entity, user, time range.

---

## 13. Acceptance criteria (Definition of Done MVP)

Hệ thống được coi là "thay thế được Excel hiện tại" khi:

1. ✅ ADMIN tạo period với `service_fee` mặc định, METER_READER nhập 100 chỉ số qua điện thoại trong < 30 phút
2. ✅ METER_READER bấm "Hoàn thành kỳ" → modal xác nhận → period chuyển READING_DONE
3. ✅ ACCOUNTANT (hoặc ADMIN) nhập EVN invoice với break-down 3 loại (Bình thường/Cao điểm/Thấp điểm) tại tab "Hóa đơn EVN"
4. ✅ Bấm Calculate → tạo 100 bill với:
   - `unit_price = (Σ EVN amount) / Σ consumption thực tế`
   - `electricity_amount = consumption × unit_price`
   - `service_amount = service_fee` (cố định, không nhân kWh)
   - `total_amount = electricity + service`
5. ✅ Review screen hiển thị: tổng EVN 3 loại, tổng đồng hồ con, hao hụt %, đơn giá, sai lệch rounding
6. ✅ ACCOUNTANT bấm "Đã đối chiếu" → period.accountant_verified_at được set
7. ✅ ADMIN bấm Approve khi chưa verified → bị reject với message rõ ràng
8. ✅ ADMIN bấm Approve sau khi verified → period APPROVED, sinh PDF + QR
9. ✅ ACCOUNTANT thử bấm Approve → bị 403; thử sửa bill sau khi APPROVED → bị 403
10. ✅ Khách CK qua VietQR → SePay webhook → bill chuyển PAID trong < 30 giây
11. ✅ Khách CK với nội dung sai → giao dịch lưu vào "unmatched", ADMIN gán thủ công được
12. ✅ Báo cáo công nợ list đúng các bill chưa PAID
13. ✅ Audit log ghi đầy đủ action quan trọng (đặc biệt là verify, approve, revert)
14. ✅ Backup MySQL hàng ngày, có thể restore

---

## 14. Roadmap (4 sprint × 2 tuần)

| Sprint | Deliverables |
|---|---|
| **S1** | Auth + Customer CRUD + Period CRUD + Meter reading flow với explicit submit (web responsive). User test: METER_READER nhập đủ 100 số đo + bấm submit. |
| **S2** | EVN Invoice (3 loại) + Calculation engine (theo §6) + Verify + Review/Approve workflow + Audit log. User test: chạy 1 kỳ thực, đối chiếu với Excel cũ. |
| **S3** | PDF + VietQR + Zalo deeplink + Print pack + Mark sent. User test: phát hành 1 kỳ thật, in giao 50 hộ, gửi Zalo 50 hộ. |
| **S4** | SePay webhook + Auto matching + Manual assign + Debt report. User test: end-to-end 1 kỳ thật, đo % giao dịch tự động khớp. |

---

## 15. Open questions / future work

- **Phụ phí (extra_fee)**: Hiện default 0. Khi cần nhập thí nghiệm/kiểm định/bảo trì → mở `period_other_charge` table (1:N), bỏ field `extra_fee` flat. Đẩy sang phase 2.
- **Phase 2 — Zalo OA**: khi ổn định thì đăng ký OA, dùng ZNS template để gửi auto.
- **Phase 2 — Mobile-first cho METER_READER**: PWA hoặc app native, hỗ trợ offline + chụp ảnh đồng hồ tự nhận diện số (OCR).
- **Phase 2 — Multi-meter per customer**: nếu có khách dùng 2 đồng hồ.
- **Phase 2 — Customer self-service portal**: KH tự xem lịch sử, hóa đơn online.
- **Phase 2 — Service fee miễn cho hộ consumption=0**: hiện vẫn tính, nếu policy đổi thì sửa §6.7.
- **Cần làm rõ với bên liên quan**: chính sách phạt nộp muộn? Có giảm trừ khi KH dùng đúng giờ thấp điểm không? (Hiện chưa thấy trong file Excel cũ.)

---

## Appendix A — Sample period data flow (kỳ T5/2026 thực tế)

| Step | Data | Status |
|---|---|---|
| 1. ADMIN tạo period "Tháng 5/2026" | start=2026-05-01, end=2026-05-31, service_fee=10,000 | OPEN |
| 2. METER_READER nhập 100 số đọc | total_actual_consumption = 37,693 kWh | OPEN |
| 3. METER_READER bấm "Hoàn thành" + confirm modal | — | READING_DONE |
| 4. ACCOUNTANT nhập 1 EVN invoice (3 loại) | normal=26,413 / peak=9,122 / off-peak=5,989; total=100,950,204 | READING_DONE |
| 5. ACCOUNTANT bấm Calculate | unit_price = 2,678.49; tạo 100 bills | CALCULATED |
| 6. ACCOUNTANT review + bấm "Đã đối chiếu" | accountant_verified_at = NOW | CALCULATED + verified |
| 7. ADMIN review: hao hụt 9.2%, đơn giá hợp lý | — | CALCULATED + verified |
| 8. ADMIN bấm Approve | gen 100 PDF + 100 QR | APPROVED |
| 9. ADMIN in print-pack, gửi Zalo | bill status SENT | APPROVED |
| 10. KH CK dần qua VietQR | bill PAID dần | APPROVED |
| 11. Sau 30 ngày, ADMIN close | period.status = CLOSED | CLOSED |