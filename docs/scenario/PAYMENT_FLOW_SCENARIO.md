# Kịch bản thanh toán hóa đơn điện qua SePay

## Tổng quan

Tài liệu này mô tả toàn bộ luồng thanh toán — từ góc độ của khách hàng đến phản hồi của hệ thống — bao gồm cả trường hợp thành công và các trường hợp ngoại lệ.

---

## Điều kiện tiên quyết

| Điều kiện | Mô tả |
|---|---|
| Kỳ điện | Đã ở trạng thái **APPROVED** |
| Hóa đơn | Đã được sinh (PDF + QR code) — `bill.qrCodeUrl != null` |
| SePay | Đã kết nối tài khoản ngân hàng và cấu hình webhook |
| Server | `SEPAY_WEBHOOK_SECRET` khớp với API Key trong SePay dashboard |

---

## Kịch bản 1 — Thanh toán đầy đủ (Happy Path)

### Bước 1: Khách hàng nhận hóa đơn

Kế toán gửi PDF hóa đơn cho khách hàng KH011 (Nguyễn Văn An) qua Zalo hoặc in ra giấy.

Hóa đơn gồm:
- Kỳ: `2025-05`
- Tiêu thụ: 120 kWh
- Tổng tiền: **320.000 đ**
- Mã thanh toán: `TIENDIEN 2025-05 KH011`
- Mã QR VietQR (đã nhúng trong PDF)

---

### Bước 2: Khách hàng quét mã QR

Khách hàng mở ứng dụng ngân hàng (TPBank, VCB, MB, v.v.), chọn **Quét mã QR**.

Ứng dụng ngân hàng tự động điền:
```
Tài khoản thụ hưởng : [số tài khoản ban quản lý]
Số tiền             : 320.000 đ
Nội dung chuyển khoản: TIENDIEN 2025-05 KH011
```

> ⚠️ **Quan trọng:** Khách hàng **không được sửa** nội dung chuyển khoản. Nếu sửa, giao dịch sẽ không được nhận diện tự động (xem Kịch bản 3).

---

### Bước 3: Khách hàng xác nhận thanh toán

Khách hàng nhấn **Chuyển tiền / Thanh toán**.

Ngân hàng xử lý giao dịch, trả về mã tham chiếu (reference code).

---

### Bước 4: SePay nhận giao dịch từ ngân hàng

SePay phát hiện giao dịch đến tài khoản ngân hàng và gửi webhook đến server:

```
POST /api/webhooks/sepay
Authorization: Apikey {SEPAY_WEBHOOK_SECRET}
Content-Type: application/json

{
  "id": "TX20250512001",
  "transferType": "in",
  "transferAmount": 320000,
  "content": "TIENDIEN 2025-05 KH011",
  "transactionDate": "2025-05-12 14:23:05",
  "referenceCode": "FT25132001234",
  "gateway": "TPBank",
  "accountNumber": "07012345678"
}
```

---

### Bước 5: Server xác thực và xử lý

**5.1 — Xác thực API Key**

`SepayWebhookAuthFilter` kiểm tra header `Authorization: Apikey {secret}`:
- Khớp → request được chuyển tiếp
- Không khớp → HTTP 401, webhook bị từ chối

**5.2 — Lọc loại giao dịch**

Chỉ xử lý `transferType = "in"` (tiền vào). Giao dịch ra bị bỏ qua.

**5.3 — Kiểm tra trùng lặp**

Kiểm tra `bankTransactionId = "TX20250512001"` trong database:
- Chưa tồn tại → tiếp tục xử lý
- Đã tồn tại → bỏ qua (idempotent, tránh ghi 2 lần)

**5.4 — Phân tích nội dung**

Regex: `TIENDIEN\s+(\S+)\s+(\S+)` áp dụng lên `"TIENDIEN 2025-05 KH011"`:
- Group 1 → `2025-05` (mã kỳ điện)
- Group 2 → `KH011` (mã khách hàng)
- Tái tạo payment code: `"TIENDIEN 2025-05 KH011"`

**5.5 — Khớp hóa đơn**

Truy vấn: `SELECT * FROM bill WHERE payment_code = 'TIENDIEN 2025-05 KH011'`
- Tìm thấy hóa đơn ID=42, khách hàng KH011, `totalAmount = 320.000 đ`, `paidAmount = 0`

**5.6 — Tạo bản ghi Payment**

```sql
INSERT INTO payment (bill_id, amount, method, paid_at, bank_transaction_id, bank_reference_code, raw_content)
VALUES (42, 320000, 'BANK_TRANSFER', '2025-05-12 14:23:05', 'TX20250512001', 'FT25132001234', 'TIENDIEN 2025-05 KH011')
```

**5.7 — Cập nhật trạng thái hóa đơn**

```
paidAmount mới = 0 + 320.000 = 320.000 đ
totalAmount    = 320.000 đ
320.000 >= 320.000 → bill.status = PAID
```

**5.8 — Phản hồi SePay**

Server luôn trả về HTTP 200 (dù có lỗi nội bộ) để SePay không retry:
```json
{ "success": true }
```

---

### Bước 6: Kế toán thấy cập nhật tự động

Kế toán đang xem tab **Hóa đơn** của kỳ 2025-05 (period APPROVED):
- Sau tối đa **30 giây**, frontend tự poll API và cập nhật danh sách
- Hóa đơn KH011 chuyển từ `SENT` → `PAID` (badge xanh lá)
- Toast thông báo xuất hiện: `"Hóa đơn KH011 (Nguyễn Văn An) đã được thanh toán tự động."`

---

### Kết quả

| Đối tượng | Trạng thái sau |
|---|---|
| `bill` (KH011) | `status = PAID`, `paidAmount = 320.000 đ` |
| `payment` | Bản ghi mới, `bill_id = 42`, `method = BANK_TRANSFER` |
| `audit_log` | Ghi nhận action `CREATE_PAYMENT`, `recordedBy = null` (system) |
| Frontend | Tự cập nhật trong 30 giây |

---

## Kịch bản 2 — Thanh toán từng phần (Partial)

Khách hàng KH005 có hóa đơn 500.000 đ, chỉ chuyển 200.000 đ.

**Xử lý của server:**
```
paidAmount mới = 0 + 200.000 = 200.000 đ
200.000 < 500.000 → bill.status = PARTIAL
```

**Lần sau khách hàng chuyển nốt 300.000 đ:**
```
paidAmount mới = 200.000 + 300.000 = 500.000 đ
500.000 >= 500.000 → bill.status = PAID
```

Frontend hiển thị toast khi bill chuyển thành PAID ở lần poll tiếp theo.

---

## Kịch bản 3 — Nội dung chuyển khoản không khớp (Unmatched)

Khách hàng sửa nội dung thành `"tien dien thang 5 nha toi"` thay vì `"TIENDIEN 2025-05 KH011"`.

**Xử lý:**
1. Regex không match → `paymentCode = null`
2. Không tìm được hóa đơn tương ứng
3. Tạo Payment với `bill_id = NULL` (unmatched)
4. Server vẫn trả HTTP 200

**Kế toán xử lý thủ công:**
1. Vào trang **Thanh toán chưa khớp** (`/payments`)
2. Tìm giao dịch với nội dung `"tien dien thang 5 nha toi"`, số tiền khớp
3. Chọn kỳ điện → chọn hóa đơn KH005
4. Nhấn **Xác nhận gán** → `POST /api/payments/{id}/assign`
5. Hóa đơn được cập nhật ngay lập tức

---

## Kịch bản 4 — Giao dịch trùng lặp từ SePay

SePay gửi lại webhook cùng `id = "TX20250512001"` (do lỗi mạng hoặc retry).

**Xử lý:**
```
existsByBankTransactionId("TX20250512001") → true → bỏ qua
```

Không tạo thêm Payment, không thay đổi `paidAmount`. Trả HTTP 200.

---

## Kịch bản 5 — Thanh toán tiền mặt (Ghi thủ công)

Khách hàng đến nộp tiền mặt tại văn phòng.

**Kế toán thao tác:**
1. Vào tab Hóa đơn → tìm KH011
2. Nhấn **Ghi thu**
3. Điền: Số tiền = 320.000, Phương thức = Tiền mặt, Ngày thu = hôm nay
4. Nhấn **Xác nhận**

**API gọi:** `POST /api/bills/42/payments`
```json
{
  "amount": 320000,
  "method": "CASH",
  "paidAt": "2025-05-12T09:00:00",
  "notes": "Nộp trực tiếp"
}
```

**Kết quả:** `bill.status = PAID`, `payment.recordedBy = [kế toán đang đăng nhập]`

---

## Sơ đồ luồng tổng quát

```
Khách hàng
    │
    ├─[Quét QR]──────────────────────────────────────────────────────┐
    │                                                                 │
    │  Ngân hàng ──[webhook]──► SePay ──[webhook]──► Server          │
    │                                                  │              │
    │                                          [match thành công]    │
    │                                                  │              │
    │                                          bill.status = PAID    │
    │                                                  │              │
    │                                          [poll 30s]            │
    │                                                  │              │
    │                                          Frontend cập nhật ◄───┘
    │
    ├─[Nội dung sai]──► Unmatched Payment ──► Kế toán gán thủ công
    │
    └─[Tiền mặt]──────► Kế toán Ghi thu thủ công

```

---

## Cấu hình cần thiết để flow hoạt động

| Mục | Nơi cấu hình | Giá trị |
|---|---|---|
| SePay Webhook URL | SePay Dashboard → Webhooks | `https://{domain}/api/webhooks/sepay` |
| SePay API Key | SePay Dashboard → Webhooks | Copy từ đây |
| Server Secret | `SEPAY_WEBHOOK_SECRET` env var | Paste giá trị vừa copy |
| Tài khoản ngân hàng | Bảng `system_setting` trong DB | `bank_account_number`, `bank_bin_tpbank`, `bank_account_holder` |

---

## Ghi chú kỹ thuật

- Server **luôn trả HTTP 200** cho SePay dù có lỗi, để tránh SePay retry không cần thiết.
- `bankTransactionId` có ràng buộc **UNIQUE** trong DB — đảm bảo idempotency tuyệt đối.
- Polling frontend mỗi **30 giây** chỉ hoạt động khi period ở trạng thái `APPROVED` hoặc `CLOSED` và tab Hóa đơn đang mở.
- Audit log ghi nhận mọi payment: tự động (`recordedBy = null`) và thủ công (`recordedBy = userId`).
