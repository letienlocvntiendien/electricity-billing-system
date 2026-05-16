# Hướng dẫn tích hợp SePay — Thanh toán QR tự động

## Tổng quan

Hệ thống dùng hai dịch vụ độc lập:

```
VietQR (img.vietqr.io)          → Sinh ảnh QR chứa thông tin chuyển khoản
SePay (sepay.vn)                → Giám sát tài khoản ngân hàng, gửi webhook khi có tiền vào
Backend (/api/webhooks/sepay)   → Nhận webhook, khớp mã thanh toán, cập nhật trạng thái hóa đơn
```

**VietQR không thông báo gì khi khách thanh toán** — chỉ sinh ảnh QR. SePay mới là thành phần theo dõi giao dịch và kích hoạt cập nhật tự động.

---

## Luồng hoàn chỉnh sau khi tích hợp

```
1. Admin duyệt kỳ (APPROVED)
        ↓
2. Hệ thống sinh PDF + QR cho từng hóa đơn
   QR chứa: STK TPBank, số tiền, nội dung "TIENDIEN {mã_kỳ} {mã_KH}"
        ↓
3. Admin gửi PDF cho khách (Zalo, in giấy, ...)
        ↓
4. Khách quét QR → app ngân hàng điền sẵn STK, số tiền, nội dung
   Khách xác nhận chuyển khoản
        ↓
5. TPBank xử lý giao dịch → SePay phát hiện tiền vào tài khoản
        ↓
6. SePay POST /api/webhooks/sepay (trong vòng vài giây)
        ↓
7. Backend khớp nội dung "TIENDIEN 2025-05 KH011" với hóa đơn
   → Cập nhật bill: SENT → PAID (hoặc PARTIAL nếu chuyển thiếu)
```

---

## Bước 1 — Đăng ký tài khoản SePay

1. Truy cập **https://sepay.vn** → Đăng ký tài khoản doanh nghiệp hoặc cá nhân
2. Xác minh email và số điện thoại
3. Đăng nhập vào dashboard SePay

---

## Bước 2 — Kết nối tài khoản ngân hàng TPBank

> Hệ thống mặc định dùng **TPBank** (BIN `970423`). Nếu muốn dùng ngân hàng khác, cập nhật key `bank_bin_tpbank` trong bảng `system_setting` và chỉnh sửa lại `VietQrService`.

Trong dashboard SePay:

1. Vào **Tài khoản ngân hàng** → **Thêm tài khoản**
2. Chọn ngân hàng: **TPBank**
3. Nhập số tài khoản và làm theo hướng dẫn xác minh quyền sở hữu
4. Chờ SePay kích hoạt theo dõi tài khoản (thường trong vòng vài phút)

---

## Bước 3 — Cấu hình Webhook trong SePay

1. Trong dashboard SePay, vào **Cài đặt webhook** (hoặc **API & Webhook**)
2. Điền **Webhook URL**:
   - **Production:** `https://your-domain.com/api/webhooks/sepay`
   - **Test local:** xem Bước 5 bên dưới (dùng ngrok)
3. SePay sẽ hiển thị hoặc cho phép bạn đặt **API Key** — copy giá trị này lại

---

## Bước 4 — Cấu hình hệ thống

### 4a. Cập nhật thông tin ngân hàng trong database

Chạy lệnh SQL sau trên database production (thay thế bằng thông tin thực):

```sql
UPDATE system_setting SET setting_value = '123456789'  WHERE setting_key = 'bank_account_number';
UPDATE system_setting SET setting_value = 'NGUYEN VAN A' WHERE setting_key = 'bank_account_holder';
-- bank_bin_tpbank đã được set sẵn là 970423 (TPBank), không cần thay đổi nếu dùng TPBank
```

> **Lưu ý:** `bank_account_holder` nên viết HOA KHÔNG DẤU để hiển thị đúng trên QR và trong app ngân hàng của khách.

### 4b. Set environment variable cho server

Đặt biến môi trường `SEPAY_WEBHOOK_SECRET` bằng API Key vừa copy từ SePay:

**Linux/macOS:**
```bash
export SEPAY_WEBHOOK_SECRET="api-key-tu-sepay"
```

**Trong file `.env` (nếu dùng Docker Compose):**
```env
SEPAY_WEBHOOK_SECRET=api-key-tu-sepay
```

**Windows (PowerShell):**
```powershell
$env:SEPAY_WEBHOOK_SECRET = "api-key-tu-sepay"
```

> **Không commit API key vào git.** File `application.properties` đã dùng pattern `${SEPAY_WEBHOOK_SECRET:dev-secret}` — biến môi trường sẽ override giá trị mặc định.

---

## Bước 5 — Test trên localhost với ngrok

SePay là dịch vụ bên ngoài — không thể gọi vào `localhost`. Dùng **ngrok** để tạo URL public tạm thời trỏ vào máy local.

### Cài ngrok

```bash
# macOS
brew install ngrok

# Windows (scoop)
scoop install ngrok

# Hoặc tải tại https://ngrok.com/download
```

### Expose localhost

```bash
ngrok http 8080
```

Ngrok sẽ hiển thị:

```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:8080
```

### Cập nhật webhook URL trong SePay

Dán URL ngrok vào SePay dashboard:
```
https://abc123.ngrok-free.app/api/webhooks/sepay
```

> **Lưu ý:** URL ngrok thay đổi mỗi lần restart (trừ khi dùng gói trả phí). Phải cập nhật lại trong SePay mỗi lần test.

---

## Bước 6 — Kiểm tra tích hợp bằng curl

Sau khi server đang chạy, dùng lệnh này để giả lập SePay gửi webhook (thay `dev-secret` bằng giá trị `SEPAY_WEBHOOK_SECRET` thực tế, và `TIENDIEN 2025-05 KH011` bằng payment code thật):

```bash
curl -X POST http://localhost:8080/api/webhooks/sepay \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey dev-secret" \
  -d '{
    "id": 999999,
    "gateway": "TPBank",
    "transactionDate": "2025-05-09 10:30:00",
    "accountNumber": "123456789",
    "content": "TIENDIEN 2025-05 KH011",
    "transferType": "in",
    "transferAmount": 500000,
    "accumulated": 500000,
    "referenceCode": "FT25129123456"
  }'
```

**Kết quả mong đợi:**
```json
{"success": true}
```

**Kiểm tra trong DB:**
```sql
SELECT id, payment_code, status, paid_amount, total_amount
FROM bill
WHERE payment_code = 'TIENDIEN 2025-05 KH011';
```
Cột `status` phải chuyển thành `PAID` (hoặc `PARTIAL` nếu `transferAmount` < `total_amount`).

---

## Checklist trước khi go-live

```
□ Đã đăng ký và xác minh tài khoản SePay
□ Đã kết nối tài khoản TPBank vào SePay
□ Đã cấu hình webhook URL production trong SePay dashboard
□ Đã set env var SEPAY_WEBHOOK_SECRET khớp với API Key của SePay
□ Đã update bank_account_number và bank_account_holder trong DB
□ Đã test curl → nhận {"success": true} và bill chuyển sang PAID
□ Đã thực hiện 1 giao dịch thật nhỏ để xác nhận end-to-end
```

---

## Troubleshooting

### Webhook nhận được nhưng bill không update

**Nguyên nhân:** Nội dung chuyển khoản của khách không khớp regex.

Kiểm tra bảng `payment` xem có bản ghi mới không, và cột `bill_id` có `null` không:
```sql
SELECT id, raw_content, bill_id, amount, paid_at
FROM payment
ORDER BY created_at DESC
LIMIT 10;
```
- Nếu có bản ghi nhưng `bill_id = null` → khách đã nhập sai nội dung CK
- Nếu không có bản ghi nào mới → webhook chưa tới được server

Admin có thể assign thủ công thanh toán không khớp qua giao diện quản lý thanh toán.

---

### SePay gửi webhook nhưng server trả 401

**Nguyên nhân:** API Key trong SePay dashboard không khớp với `SEPAY_WEBHOOK_SECRET`.

Kiểm tra log server:
```
SePay webhook: invalid API key from 103.x.x.x
```

Đảm bảo giá trị `SEPAY_WEBHOOK_SECRET` khi khởi động server giống hệt API Key đang cấu hình trong SePay.

---

### Webhook không tới được server (server không ghi log gì)

Nguyên nhân có thể:
1. **Test local:** Chưa dùng ngrok, hoặc URL ngrok đã hết hạn
2. **Production:** Tường lửa chặn port 443/80, hoặc webhook URL sai
3. **SePay chưa kết nối được ngân hàng:** Kiểm tra lại bước 2

Dùng SePay dashboard → **Lịch sử webhook** để xem SePay có gửi đi không và nhận phản hồi gì.

---

### QR hiển thị đúng nhưng số tiền hoặc STK sai

Kiểm tra lại giá trị trong `system_setting`:
```sql
SELECT setting_key, setting_value FROM system_setting
WHERE setting_key IN ('bank_account_number', 'bank_account_holder', 'bank_bin_tpbank');
```
VietQrService đọc các giá trị này trực tiếp mỗi lần sinh QR — thay đổi trong DB có hiệu lực ngay, không cần restart server.
