# Kịch bản kiểm tra — Electricity Billing System

Tài liệu này mô tả kịch bản thử nghiệm toàn bộ luồng nghiệp vụ từ khi tạo kỳ đến khi đóng kỳ,
với số liệu cụ thể để xác minh tính đúng đắn của phép tính.

---

## Chuẩn bị

### 1. Xóa dữ liệu cũ

```bash
# Chạy script SQL (giữ lại user và customer)
mysql -u root -p electricity_billing < sql/clear_billing_data.sql
```

Sau khi chạy, tất cả kỳ cũ (billing_period, evn_invoice, meter_reading, bill, payment) sẽ bị xóa.
10 khách hàng (KH001–KH010) và 3 tài khoản vẫn còn nguyên.

### 2. Khởi động ứng dụng

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

### 3. Tài khoản hệ thống

| Tài khoản | Mật khẩu | Vai trò | Quyền chính |
|-----------|----------|---------|-------------|
| `admin` | `Admin@123` | ADMIN | Tạo kỳ, phê duyệt, hoàn về, đóng kỳ |
| `accountant` | `Account@123` | ACCOUNTANT | Thêm HD EVN, tính tiền, đối chiếu, ghi thu |
| `reader` | `Reader@123` | METER_READER | Ghi chỉ số đồng hồ, hoàn thành kỳ |

---

## Kịch bản 1 — Full Lifecycle (Luồng chính)

### Số liệu kịch bản: Kỳ tháng 05/2026

Số liệu được thiết kế để **đơn giá = số nguyên** (dễ kiểm tra thủ công).

| Thông số EVN | Giá trị |
|---|---|
| Kỳ | 2026-05-01 → 2026-05-31 |
| Tên kỳ | Kỳ tháng 05/2026 |
| EVN kWh | **2.860 kWh** |
| EVN tiền | **4.290.000 đ** |
| Phụ phí (extraFee) | 0 đ |
| Phí ghi điện (serviceFee) | **10.000 đ/hộ** (flat, không nhân với kWh) |

### Chỉ số đồng hồ cần nhập

> Đây là lần đầu, tất cả chỉ số cũ = 0.

| Khách hàng | Chỉ số cũ | Chỉ số mới | Tiêu thụ |
|-----------|-----------|------------|---------|
| KH001 | 0 | **300** | 300 kWh |
| KH002 | 0 | **250** | 250 kWh |
| KH003 | 0 | **400** | 400 kWh |
| KH004 | 0 | **200** | 200 kWh |
| KH005 | 0 | **350** | 350 kWh |
| KH006 | 0 | **150** | 150 kWh |
| KH007 | 0 | **280** | 280 kWh |
| KH008 | 0 | **320** | 320 kWh |
| KH009 | 0 | **230** | 230 kWh |
| KH010 | 0 | **270** | 270 kWh |
| **Tổng** | | | **2.750 kWh** |

---

### Bước 1 — Tạo kỳ `[ADMIN]`

1. Đăng nhập tài khoản `admin`
2. Menu **Kỳ tính điện** → **Tạo kỳ mới**
3. Điền:
   - Tên: `Kỳ tháng 05/2026`
   - Từ ngày: `2026-05-01`
   - Đến ngày: `2026-05-31`
   - Phí ghi điện: `10000`
4. Nhấn **Tạo**

**✅ Kết quả mong đợi:**
- Kỳ xuất hiện trong danh sách với status `OPEN`
- Tab Chỉ số hiển thị 10 hàng (1 hàng/khách hàng), tất cả "Chưa đọc"

---

### Bước 2 — Ghi chỉ số đồng hồ `[READER]`

1. Đăng xuất, đăng nhập tài khoản `reader`
2. Vào kỳ vừa tạo → tab **Chỉ số**
3. Nhập chỉ số mới theo bảng trên cho từng hộ, nhấn **Ghi** sau mỗi hộ

**Ghi một phần trước để test:**
- Nhập KH001 → KH008 trước (8/10 hộ)
- Quan sát thanh tiến độ: `8/10`

4. Tiếp tục nhập KH009 và KH010
- Quan sát thanh tiến độ: `10/10` + dòng "Tất cả đã ghi — kỳ sẵn sàng tính tiền"

**✅ Kết quả mong đợi:** Tất cả 10 hàng hiển thị chỉ số mới và thời gian ghi.

---

### Bước 3 — Hoàn thành kỳ ghi `[READER]`

Nhấn nút **Hoàn thành kỳ này** trong tab Chỉ số.

**✅ Kết quả mong đợi:** Status kỳ chuyển từ `OPEN` → **`READING_DONE`**

---

### Bước 4 — Thêm hóa đơn EVN `[ACCOUNTANT]`

1. Đăng xuất, đăng nhập tài khoản `accountant`
2. Vào kỳ → tab **HD EVN** → nhấn **Thêm HD EVN**
3. Điền:
   - Ngày hóa đơn: `2026-05-31`
   - Số hóa đơn: `EVN-202605`
   - kWh: `2860`
   - Số tiền: `4290000`
4. Nhấn **Lưu**

**✅ Kết quả mong đợi:**
- 1 hóa đơn EVN xuất hiện trong danh sách
- Card "Hóa đơn EVN" ở phần tóm tắt cập nhật: `2.860 kWh`, `4.290.000 đ`

---

### Bước 5 — Xem đối chiếu (Review) `[ACCOUNTANT]`

Nhấn nút **Xem đối chiếu** trong action bar.

**✅ Kiểm tra từng dòng trong modal:**

| Trường | Giá trị mong đợi |
|--------|-----------------|
| Tổng kWh EVN | 2.860 kWh |
| Tổng tiền EVN | 4.290.000 đ |
| Tiêu thụ thực tế | 2.750 kWh |
| Hao hụt (EVN − thực tế) | 110 kWh |
| Tỉ lệ hao hụt | 3,85% |
| Cảnh báo vượt ngưỡng | **Không có** (3,85% < 15%) |
| Đơn giá dự kiến | **1.560,00 đ/kWh** |
| Phí ghi điện | 10.000 đ/hộ |
| Số hộ tính tiền | 10 hộ |
| Tổng dự kiến | **4.390.000 đ** |

> **Cách tính kiểm tra:**
> `unit_price = 4.290.000 / 2.750 = 1.560 đ/kWh`
> `Tổng = 2.750 × 1.560 + 10 × 10.000 = 4.290.000 + 100.000 = 4.390.000 đ`

---

### Bước 6 — Tính tiền `[ACCOUNTANT]`

Nhấn nút **Tính tiền** trong action bar.

**✅ Status kỳ:** `READING_DONE` → **`CALCULATED`**

**✅ Kiểm tra tab Hóa đơn — 10 hóa đơn với giá trị sau:**

| KH | kWh | Tiền điện | Phí GĐ | **Tổng** | Status |
|----|-----|-----------|--------|---------|--------|
| KH001 | 300 | 468.000 | 10.000 | **478.000** | PENDING |
| KH002 | 250 | 390.000 | 10.000 | **400.000** | PENDING |
| KH003 | 400 | 624.000 | 10.000 | **634.000** | PENDING |
| KH004 | 200 | 312.000 | 10.000 | **322.000** | PENDING |
| KH005 | 350 | 546.000 | 10.000 | **556.000** | PENDING |
| KH006 | 150 | 234.000 | 10.000 | **244.000** | PENDING |
| KH007 | 280 | 436.800 | 10.000 | **446.800** | PENDING |
| KH008 | 320 | 499.200 | 10.000 | **509.200** | PENDING |
| KH009 | 230 | 358.800 | 10.000 | **368.800** | PENDING |
| KH010 | 270 | 421.200 | 10.000 | **431.200** | PENDING |
| **Tổng** | 2.750 | 4.290.000 | 100.000 | **4.390.000** | — |

> **Card "Kết quả tính toán":** Hiển thị `1.560,00 đ/kWh` (2 chữ số thập phân)

---

### Bước 7 — Đối chiếu kế toán `[ACCOUNTANT]`

Nhấn nút **Đã đối chiếu EVN** trong action bar.

**✅ Kết quả mong đợi:**
- Nút biến mất, thay bằng dòng "Kế toán Nguyễn Thị Hoa đã đối chiếu"
- Card "Kết quả tính toán" hiển thị checkmark xanh + tên kế toán
- Modal "Xem đối chiếu" hiển thị thời gian đối chiếu

---

### Bước 8 — Phê duyệt kỳ `[ADMIN]`

1. Đăng xuất, đăng nhập tài khoản `admin`
2. Nhấn nút **Duyệt kỳ**

**✅ Status kỳ:** `CALCULATED` → **`APPROVED`**

> Lưu ý: Nếu kế toán chưa đối chiếu (Bước 7), nút "Duyệt kỳ" sẽ bị disabled.

---

### Bước 9 — Ghi thu thanh toán `[ACCOUNTANT]`

1. Đăng nhập `accountant`, vào tab **Hóa đơn**

**Test PAID — KH001 trả đủ:**
- Nhấn **Ghi thu** trên hàng KH001
- Số tiền: `478000`, Hình thức: Tiền mặt → **Lưu**
- ✅ KH001: status → **PAID**, Đã trả = 478.000

**Test PARTIAL — KH002 trả một phần:**
- Nhấn **Ghi thu** trên hàng KH002
- Số tiền: `200000`, Hình thức: Tiền mặt → **Lưu**
- ✅ KH002: status → **PARTIAL**, Đã trả = 200.000 / 400.000

**KH003–KH010:** Giữ nguyên PENDING để kiểm tra báo cáo nợ.

---

### Bước 10 — Đóng kỳ `[ADMIN]`

Nhấn nút **Đóng kỳ** trong action bar.

**✅ Status kỳ:** `APPROVED` → **`CLOSED`**

---

## Kịch bản 2 — Hoàn về (Revert)

### 2A — Revert từ CALCULATED

1. Thực hiện các bước 1–6 (dừng ở CALCULATED, chưa verify)
2. Nhấn **Hoàn về**
3. ✅ Status → `OPEN`, tab Hóa đơn trống, readings giữ nguyên
4. Có thể chỉnh sửa lại extraFee rồi tính lại

### 2B — Revert từ APPROVED

1. Thực hiện bước 1–8 (đến APPROVED)
2. Nhấn **Hoàn về**
3. ✅ Status → `OPEN`, bills bị xóa, verifiedBy/At bị xóa
4. Cần làm lại từ bước 6 (tính tiền)

---

## Kịch bản 3 — Với extraFee (nâng cao)

Dùng cùng chỉ số đồng hồ trên, nhưng khi tạo kỳ đặt `extraFee = 275.000 đ` (PATCH /periods/{id}):

```
unit_price = (4.290.000 + 275.000) / 2.750
           = 4.565.000 / 2.750
           = 1.660 đ/kWh  ✓
```

**Hóa đơn KH001:** 300 × 1.660 + 10.000 = **508.000 đ**

---

## Kịch bản 4 — Guard "Tính tiền" khi chưa có HD EVN

1. Tạo kỳ mới, ghi đủ chỉ số, nhấn "Hoàn thành kỳ" → READING_DONE
2. **Không** thêm hóa đơn EVN
3. ✅ Nút "Tính tiền" hiển thị icon cảnh báo và bị disabled
4. Tooltip: "Cần thêm hóa đơn EVN trước"

---

## Kịch bản 5 — Guard "Duyệt kỳ" khi chưa đối chiếu

1. Tính tiền xong → CALCULATED
2. **Không** nhấn "Đã đối chiếu EVN"
3. ✅ Nút "Duyệt kỳ" bị disabled (ADMIN thấy nút mờ, tooltip "Cần kế toán đối chiếu trước")

---

## Tóm tắt kiểm tra công thức

```
Công thức:
  unit_price        = (evn_amount + extra_fee) / total_consumption   [2 decimal, HALF_UP]
  electricity_amount = unit_price × consumption                       [làm tròn đến đồng nguyên]
  service_amount     = service_fee                                    [flat, không nhân kWh]
  total_amount       = electricity_amount + service_amount

Kịch bản 1 kiểm tra:
  unit_price = 4.290.000 / 2.750 = 1.560,00 đ/kWh
  KH001: 300 × 1.560 + 10.000 = 478.000 đ ✓
  KH007: 280 × 1.560 + 10.000 = 446.800 đ ✓  (không lẻ → làm tròn không ảnh hưởng)
  Tổng: 4.390.000 đ ✓
```
