# Technical: PDF Generation, VietQR & Bill Issuance

## 1. Tổng quan flow

```
Period APPROVED (Admin)
        │
        ▼
PeriodApprovedEvent published (trong transaction)
        │
        ▼  [AFTER_COMMIT — async thread pool]
BillGenerationService.onPeriodApproved()
        │
        ├─ For each Bill:
        │       ├─ VietQrService.buildQrUrl()   → URL string (external API)
        │       ├─ PdfGenerationService.generateAndStore()  → file lưu disk
        │       ├─ bill.qrCodeUrl  = qrUrl
        │       ├─ bill.pdfUrl     = "pdf/{periodCode}/{billId}.pdf"
        │       ├─ bill.status     = SENT
        │       └─ bill.sentAt     = now()
        │
        └─ Sau khi xong: Frontend show nút PDF + QR trên từng hóa đơn
```

---

## 2. VietQR — Cách sinh mã QR thanh toán

### Nguyên lý

Không dùng thư viện tạo QR nội bộ. **VietQRService chỉ build một URL** trỏ tới API của vietqr.io — server trả về file ảnh PNG chứa mã QR chuẩn VietQR.

**File:** `infrastructure/qr/VietQrService.java`

### URL template

```
https://img.vietqr.io/image/{bankBin}-{accountNumber}-compact2.png
    ?amount={totalAmount}
    &addInfo={paymentCode}
    &accountName={accountHolder}
```

**Ví dụ thực tế:**
```
https://img.vietqr.io/image/970418-12345678-compact2.png
    ?amount=500000
    &addInfo=TIENDIEN%202025-05%20A001
    &accountName=NGUYEN%20VAN%20A
```

### Tham số cấu hình (trong `system_setting` table)

| Key | Ví dụ | Mô tả |
|-----|-------|-------|
| `bank_bin` | `970418` | Mã ngân hàng VietQR (BIDV = 970418, Vietcombank = 970436, v.v.) |
| `bank_account_number` | `12345678` | Số tài khoản thu tiền |
| `bank_account_holder` | `TRAN VAN B` | Tên chủ tài khoản (in hoa, không dấu) |

### Kết quả

- `qrCodeUrl` lưu vào `bill.qr_code_url` là **URL hình ảnh PNG** — không lưu ảnh local.
- URL này được nhúng trực tiếp vào file PDF (download từ internet khi gen PDF).
- URL này cũng được trả về frontend qua `BillResponse.qrCodeUrl` để hiển thị `<img>`.

---

## 3. PDF Generation — Sinh hóa đơn PDF

### Thư viện

**OpenPDF 2.0.3** (`com.github.librepdf:openpdf`) — nhánh open-source của iText 5.

```xml
<!-- pom.xml -->
<dependency>
    <groupId>com.github.librepdf</groupId>
    <artifactId>openpdf</artifactId>
    <version>2.0.3</version>
</dependency>
```

**File:** `infrastructure/pdf/PdfGenerationService.java`

### Layout PDF (khổ A5 portrait — 420×595 pt, margin 28pt)

```
┌──────────────────────────────────┐
│        HÓA ĐƠN TIỀN ĐIỆN        │  ← tiêu đề, font DejaVuSans
│         Kỳ: {period.name}        │
├──────────────────────────────────┤
│ Khách hàng: {fullName}           │
│ Mã hộ:      {code}               │
│ Kỳ đọc:     {startDate}→{endDate}│
├──────────────────────────────────┤
│ Chỉ số cũ  │ Chỉ số mới │  kWh  │
│ {prev}     │ {curr}     │  {n}  │
├──────────────────────────────────┤
│ Tiền điện:    {electricityAmt} đ │
│ Phí ghi điện: {serviceAmt}     đ │
│ TỔNG:         {totalAmount}    đ │
├──────────────────────────────────┤
│ Nội dung CK: TIENDIEN YYYY-MM    │
│              {customerCode}      │
├──────────────────────────────────┤
│           [QR CODE 100×100]      │  ← embedded từ vietqr.io URL
└──────────────────────────────────┘
```

### Font tiếng Việt

- **Primary:** `DejaVuSans.ttf` từ `src/main/resources/fonts/` — hỗ trợ Unicode đầy đủ.
- **Fallback:** Helvetica — nếu không tìm thấy font file.

### Lưu trữ file

**Service:** `infrastructure/storage/LocalFileStorageService.java`

- **Config:** `app.upload.dir` (env var `UPLOAD_DIR`, default: `"uploads"`)
- **Đường dẫn:** `{uploadDir}/pdf/{periodCode}/{billId}.pdf`
- **Ví dụ:** `uploads/pdf/2025-05/42.pdf`
- Hàm `store(byte[], relativePath)` tự tạo thư mục cha nếu chưa tồn tại.
- `pdfUrl` lưu trong DB là **relative path** (`"pdf/2025-05/42.pdf"`), không phải URL tuyệt đối.

---

## 4. Async Processing — Kiến trúc bất đồng bộ

### Thread pool

**File:** `config/AsyncConfig.java`

```
Name prefix : "pdf-gen-"
Core threads: 4
Max threads : 8
Queue       : 100 tasks
```

### Event lifecycle (Transaction-safe)

```
1. PeriodService.approve() chạy trong @Transactional
2. eventPublisher.publishEvent(new PeriodApprovedEvent(periodId))
3. Transaction COMMIT thành công
4. Spring fires: BillGenerationService.onPeriodApproved()
   - @TransactionalEventListener(phase = AFTER_COMMIT) ← chỉ chạy sau commit
   - @Async("pdfTaskExecutor")                        ← chạy trên thread pool riêng
   - @Transactional(propagation = REQUIRES_NEW)       ← transaction độc lập
```

**Lý do thiết kế này:**
- `AFTER_COMMIT`: đảm bảo bills đã persist vào DB trước khi đọc để gen PDF.
- `REQUIRES_NEW`: nếu PDF gen lỗi → chỉ rollback task đó, không ảnh hưởng transaction approve.
- `@Async`: approve trả về ngay cho client, không chờ PDF gen xong (có thể mất vài giây cho 100 bills).

---

## 5. Bill Issuance — Phát hành hóa đơn

### Luồng chính (tự động)

| Bước | Trigger | Kết quả |
|------|---------|---------|
| Period CALCULATED | Admin gọi `/calculate` | Bills tạo với status `PENDING`, chưa có PDF/QR |
| Period APPROVED | Admin gọi `/approve` | `PeriodApprovedEvent` → async gen PDF + QR → bills chuyển `SENT` |
| Payment received | `/bills/{id}/payments` | `PARTIAL` hoặc `PAID` |
| 30 ngày trôi qua | Cron 2 AM | `SENT`/`PARTIAL` → `OVERDUE` |
| Period CLOSED | Admin gọi `/close` | Yêu cầu tất cả bills = `PAID` |

### Manual override: Mark Sent

`POST /api/bills/{id}/mark-sent`

Dùng khi: PDF gen lỗi, hoặc admin muốn đánh dấu thủ công.

```
Điều kiện: period.status phải là APPROVED (không phải OPEN)
Hành động: sentViaZalo=true, sentAt=now(), PENDING→SENT
```

### Bill Status transitions

```
PENDING ──(period approved, async gen done)──► SENT
SENT    ──(partial payment)──────────────────► PARTIAL
SENT    ──(full payment)─────────────────────► PAID
PARTIAL ──(remaining payment)────────────────► PAID
SENT    ──(30 days, cron job)────────────────► OVERDUE
PARTIAL ──(30 days, cron job)────────────────► OVERDUE
```

### Overdue Scheduler

**File:** `application/service/OverdueScheduler.java`

```
Cron   : 0 0 2 * * *  (mỗi ngày 2:00 AM)
Profile: !dev          (không chạy ở dev)
Config : system_setting key "overdue_days" (default: 30)
Query  : UPDATE bill SET status='OVERDUE'
         WHERE status IN ('SENT','PARTIAL')
         AND period.approvedAt < (now - overdue_days)
```

---

## 6. Notification — Gửi thông báo

### Hiện tại: Zalo Deeplink (manual)

Không có push notification tự động. Thay vào đó, hệ thống tạo **Zalo deeplink** cho mỗi hóa đơn.

**File:** `infrastructure/zalo/ZaloDeeplinkBuilder.java`

**Endpoint:** `GET /api/bills/{id}/zalo-link`

### Cách hoạt động

```
1. Lấy bill → lấy customer.zaloPhone
2. Build message template:
   "Xin chào {fullName},
    Tiền điện kỳ {period.name}: {consumption} kWh
    Số tiền: {totalAmount} đ
    Mã CK: {paymentCode}
    Hạn: {approvedAt + overdue_days}"

3. URL encode message
4. Trả về: "https://zalo.me/{phone}?text={encodedMessage}"
```

**Yêu cầu:** `Customer.zaloPhone` phải được điền (nullable field).

### Tracking đã gửi

| Field | Ý nghĩa |
|-------|---------|
| `bill.sentViaZalo` | `true` sau khi nhân viên click gửi |
| `bill.sentAt` | Timestamp lần gửi |
| `bill.status` → `SENT` | Chuyển từ PENDING sau khi gửi |

**Lưu ý:** Field `sentAt` và `SENT` status cũng được set bởi async gen sau period approve — không chỉ từ Zalo. Trên thực tế, `SENT` chỉ có nghĩa là "đã phát hành" (có PDF+QR), không nhất thiết đã gửi Zalo.

---

## 7. Print Pack — File tổng hợp

`GET /api/periods/{id}/print-pack`

**File:** `infrastructure/pdf/PrintPackService.java`

### Mục đích

Tải về một file PDF duy nhất chứa tất cả hóa đơn của kỳ (để in một lần hoặc lưu trữ).

### Cách hoạt động

```
1. Lấy tất cả bills của period
2. Filter: chỉ lấy bill đã có pdfUrl (đã gen xong)
3. Sort theo customerCode (A→Z)
4. Dùng OpenPDF PdfCopy merge tất cả PDFs thành 1 file
5. Response headers:
   Content-Type: application/pdf
   Content-Disposition: attachment; filename="print-pack-{periodCode}.pdf"
```

**Lưu ý:** Nếu một số bills chưa có PDF (async gen chưa xong), chúng bị bỏ qua trong print pack.

---

## 8. Endpoints liên quan

| Endpoint | Method | Auth | Mô tả |
|----------|--------|------|-------|
| `POST /api/periods/{id}/approve` | POST | ADMIN | Approve period → trigger async PDF/QR gen |
| `GET /api/periods/{id}/print-pack` | GET | ADMIN, ACCOUNTANT | Download PDF tổng hợp cả kỳ |
| `GET /api/bills/{id}` | GET | ADMIN, ACCOUNTANT | Bill detail kèm `pdfUrl`, `qrCodeUrl` |
| `POST /api/bills/{id}/mark-sent` | POST | ADMIN, ACCOUNTANT | Manual mark SENT |
| `GET /api/bills/{id}/zalo-link` | GET | ADMIN, ACCOUNTANT | Lấy Zalo deeplink |
| `POST /api/bills/{id}/payments` | POST | ADMIN, ACCOUNTANT | Ghi nhận thanh toán |

---

## 9. Cấu hình cần thiết trước khi dùng

Các key trong bảng `system_setting` phải được điền đúng:

| Key | Bắt buộc | Mô tả |
|-----|----------|-------|
| `bank_bin` | ✅ | Mã BIN ngân hàng (VietQR) |
| `bank_account_number` | ✅ | Số tài khoản thu tiền điện |
| `bank_account_holder` | ✅ | Tên chủ tài khoản (không dấu) |
| `overdue_days` | ❌ (default 30) | Số ngày sau approve thì mark OVERDUE |
| `loss_warning_threshold` | ❌ (default 15) | Ngưỡng % tổn thất điện năng cảnh báo |

---

## 10. Key files

| Component | File path |
|-----------|-----------|
| Event trigger | `application/service/PeriodService.java` → `approve()` |
| Async listener | `application/service/BillGenerationService.java` |
| PDF gen | `infrastructure/pdf/PdfGenerationService.java` |
| Print pack merge | `infrastructure/pdf/PrintPackService.java` |
| VietQR URL builder | `infrastructure/qr/VietQrService.java` |
| Zalo deeplink | `infrastructure/zalo/ZaloDeeplinkBuilder.java` |
| File storage | `infrastructure/storage/LocalFileStorageService.java` |
| Overdue cron | `application/service/OverdueScheduler.java` |
| Thread pool config | `config/AsyncConfig.java` |
| Bill entity | `domain/bill/Bill.java` |
| Bill DTO | `application/dto/response/BillResponse.java` |
