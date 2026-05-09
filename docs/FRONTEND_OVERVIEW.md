# Electricity Billing System — Frontend Overview

Tài liệu này mô tả giao diện hiện tại của hệ thống quản lý tiền điện khu phố (~100 hộ dùng chung đồng hồ EVN tổng). Mục đích: cung cấp ngữ cảnh cho thiết kế UI/UX.

---

## Tech Stack & App Shell

- **React 19 + TypeScript**, build bằng Vite
- **Tailwind CSS** cho styling
- **Desktop**: Sidebar cố định bên trái (240px, nền tối) + vùng nội dung bên phải
- **Mobile**: Header sticky phía trên + thanh điều hướng cố định phía dưới (bottom nav)
- Font: hệ thống (sans-serif)

---

## Navigation & Roles

Ba vai trò trong hệ thống, quyết định menu và tính năng hiển thị:

| Vai trò | Quyền chính |
|---|---|
| **ADMIN** | Toàn quyền — tạo/duyệt kỳ, quản lý khách hàng, cài đặt |
| **ACCOUNTANT** | Quản lý hóa đơn EVN, tính tiền, ghi thu |
| **METER_READER** | Chỉ nhập và nộp chỉ số điện |

**Menu items** (sidebar desktop / bottom nav mobile):
1. **Tổng quan** — tất cả vai trò
2. **Kỳ thanh toán** — tất cả vai trò
3. **Khách hàng** — ADMIN + ACCOUNTANT
4. **Báo cáo** — ADMIN + ACCOUNTANT
5. **Cài đặt** — ADMIN
6. **Đăng xuất** — tất cả vai trò

Sidebar hiển thị tên người dùng và badge vai trò (màu amber = ADMIN, sky = ACCOUNTANT, emerald = METER_READER) ở footer.

---

## Pages

### 1. Login

**Layout**: Toàn màn hình, nền tối với hiệu ứng lưới và ánh sáng trung tâm. Một card đăng nhập căn giữa với logo "TIỀN ĐIỆN", hai ô nhập liệu (tên đăng nhập, mật khẩu), nút đăng nhập.

**Tương tác**:
- Nhập username và password → nhấn nút hoặc Enter để đăng nhập
- Khi đang xác thực: nút hiển thị spinner + chữ "Đang xác thực..."
- Sai thông tin: banner đỏ "Sai tên đăng nhập hoặc mật khẩu."
- Thành công: chuyển sang trang Tổng quan

**Đặc biệt**: Session hết hạn từ bất kỳ trang nào → tự động chuyển về Login.

---

### 2. Dashboard (Tổng quan)

**Layout**:
- Tiêu đề "Tổng quan" + phụ đề "Tình trạng hệ thống điện khu phố"
- **3 stat cards** (responsive grid): kỳ đang xử lý, số kỳ đã duyệt chờ đóng, tổng số kỳ
- **Danh sách kỳ**: bảng/list cuộn được, mỗi dòng hiển thị tên kỳ + khoảng thời gian + badge trạng thái

**Trạng thái badge** (5 màu):
- OPEN = xanh dương · READING_DONE = cam · CALCULATED = tím · APPROVED = xanh lá · CLOSED = xám

**Tương tác**: Nhấn vào bất kỳ dòng kỳ nào → chuyển sang trang chi tiết kỳ đó.

**Trạng thái UI**: Loading spinner → danh sách hoặc thông báo "Chưa có kỳ nào."

---

### 3. Customers (Khách hàng)

**Layout**:
- Header: icon + "Khách hàng" + số lượng + nút "Thêm khách hàng" (ADMIN only, góc phải)
- **Bảng**: Mã KH | Họ tên | Điện thoại | Số đồng hồ | Trạng thái (Hoạt động / Ngừng) | Nút sửa + xóa (ADMIN only)

**Tương tác**:
- **Thêm** (ADMIN): Mở dialog với form — mã KH, họ tên, điện thoại, số Zalo, số đồng hồ, ghi chú
- **Sửa** (ADMIN): Dialog tương tự, điền sẵn dữ liệu + toggle trạng thái hoạt động
- **Xóa** (ADMIN): Xác nhận rồi xóa, cập nhật danh sách ngay
- METER_READER: chỉ xem, không có nút hành động

**Trạng thái UI**: Loading → bảng hoặc "Chưa có khách hàng." | Lỗi lưu hiển thị trong dialog.

---

### 4. Periods (Kỳ thanh toán)

**Layout**:
- Header: icon + "Kỳ thanh toán" + số lượng + nút "Tạo kỳ mới" (ADMIN only)
- **Bảng**: Tên kỳ (link) | Thời gian (ngày bắt đầu → kết thúc) | EVN kWh | Đơn giá | Trạng thái | Nút sửa

**Tương tác**:
- **Tạo kỳ** (ADMIN): Dialog — tên kỳ, ngày bắt đầu, ngày kết thúc, phí dịch vụ (mặc định 10.000đ)
- **Sửa kỳ** (ADMIN): Dialog — tên kỳ, phí dịch vụ, phụ phí (chỉ khi kỳ chưa bị khóa — tức chưa APPROVED/CLOSED)
- **Xem chi tiết**: Nhấn tên kỳ → chuyển sang PeriodDetailPage
- Kỳ APPROVED/CLOSED: nút sửa ẩn

**Trạng thái UI**: Loading → bảng hoặc "Chưa có kỳ nào."

---

### 5. Period Detail (Chi tiết kỳ) — Trang phức tạp nhất

**Layout tổng thể**:
- **Header**: nút Back + tên kỳ + badge trạng thái + khoảng ngày
- **Stats bar**: 4 ô (EVN kWh | EVN tiền | Đơn giá điện | Phí ghi điện)
- **Action bar**: các nút hành động thay đổi theo trạng thái và vai trò (xem bên dưới)
- **Tabs** (3 tab, hiển thị theo vai trò):
  - **HD EVN** — ACCOUNTANT
  - **Chỉ số** — tất cả vai trò
  - **Hóa đơn** — ACCOUNTANT

---

#### Tab "HD EVN" (Hóa đơn EVN)

Danh sách hóa đơn điện EVN đã nhập thủ công: Ngày | Số HĐ | kWh | Số tiền | Nút xóa.

Nút "Thêm HD EVN" mở dialog: ngày, số hóa đơn, kWh, số tiền.

---

#### Tab "Chỉ số" (Chỉ số điện)

**Desktop — Bảng**:
- Cột: Khách hàng | Chỉ số cũ | Chỉ số mới (ô nhập hoặc giá trị đã nộp) | Tiêu thụ (kWh) | Thời gian nộp | Nút Nộp
- Dòng chưa nộp: nền vàng nhạt (amber)

**Mobile — Cards**:
- Mỗi khách hàng là 1 card: tên + chỉ số cũ + ô nhập chỉ số mới + nút Nộp lớn
- Dòng đã nộp dồn xuống cuối danh sách

**Progress bar**: tiến độ nộp chỉ số (X/tổng), chuyển xanh khi hoàn tất.

**Tương tác**:
- METER_READER nhập từng chỉ số → nhấn Nộp → cập nhật ngay, ô chuyển thành text (không sửa được)
- Sau khi nộp thành công: hiệu ứng flash xanh ngắn trên dòng đó
- Validate: chỉ số mới ≥ chỉ số cũ

---

#### Tab "Hóa đơn"

**Desktop — Bảng**: Khách hàng | kWh | Tổng tiền | Đã trả | Trạng thái | Nút hành động

**Mobile — Cards (3 cột)**: mỗi card hiển thị kWh, tổng tiền, đã trả; nút hành động bên dưới

**Nút hành động** (chỉ xuất hiện khi kỳ APPROVED hoặc CLOSED, ACCOUNTANT):
- **Ghi thu**: Mở dialog — số tiền, phương thức (tiền mặt/chuyển khoản/khác), thời gian
- **Gửi**: Đánh dấu đã gửi hóa đơn (chỉ khi bill đang PENDING)
- **Zalo**: Mở link Zalo chia sẻ trên tab mới (hoặc báo lỗi nếu khách không có số Zalo)

---

#### Action Bar — Các nút thay đổi theo trạng thái + vai trò

| Trạng thái kỳ | Vai trò | Nút |
|---|---|---|
| OPEN | ACCOUNTANT | "Thêm HD EVN" |
| OPEN | METER_READER | "Nộp tất cả chỉ số" |
| READING_DONE | ACCOUNTANT | "Thêm HD EVN" + "Tính tiền" |
| CALCULATED | ACCOUNTANT | "Đã đối chiếu EVN" (nếu chưa duyệt) hoặc hiển thị "đã xác nhận bởi X lúc Y" |
| CALCULATED | ADMIN | "Duyệt kỳ" (disabled cho đến khi ACCOUNTANT xác nhận) + "Hoàn về" |
| APPROVED | ADMIN | "Đóng kỳ" |

Tất cả hành động phá hủy (tính tiền, duyệt, hoàn về, đóng kỳ, xóa hóa đơn, nộp tất cả) đều có hộp thoại xác nhận.

---

### 6. Reports (Báo cáo)

**Layout**:
- Header: icon + "Báo cáo" + phụ đề "Công nợ và tình trạng thanh toán"
- **Card công nợ**: tiêu đề + biểu tượng cảnh báo + số lượng hóa đơn + tổng số tiền chưa thu (đỏ, góc phải)
- **Bảng**: Khách hàng | Kỳ | Tổng tiền | Còn lại (đỏ, in đậm) | Trạng thái

**Tương tác**: Chỉ xem, không có hành động. Không nhấn được vào dòng để xem chi tiết.

**Trạng thái UI**: Loading → bảng hoặc "Không có công nợ."

---

### 7. Settings (Cài đặt hệ thống)

**Layout**:
- Header: icon + "Cài đặt hệ thống" + phụ đề
- **Card cài đặt**: danh sách các key-value, mỗi dòng gồm tên khóa (monospace) + mô tả + giá trị hiện tại + nút sửa (bút chì, ADMIN only)

**Tương tác** (ADMIN):
- Nhấn bút chì → dòng đó chuyển sang chế độ chỉnh sửa inline (ô input, nút lưu, nút hủy)
- Enter = lưu, Escape = hủy
- Lưu xong → ô đóng lại, giá trị mới hiển thị

**Trạng thái UI**: Loading → danh sách hoặc "Không có cài đặt." | Banner lỗi nếu không tải được hoặc không lưu được.

---

## Key Workflows

### Vòng đời kỳ thanh toán

```
ADMIN tạo kỳ (OPEN)
  ↓
METER_READER nhập chỉ số từng hộ → khi đủ 100%: tự chuyển READING_DONE
  ↓
ACCOUNTANT nhập hóa đơn EVN + nhấn "Tính tiền" → CALCULATED
  ↓
ACCOUNTANT đối chiếu với EVN → xác nhận
  ↓
ADMIN duyệt kỳ → APPROVED (khóa dữ liệu)
  ↓
ACCOUNTANT gửi/ghi thu từng hóa đơn
  ↓
ADMIN đóng kỳ → CLOSED
```

Nếu có sai sót sau khi tính tiền: ADMIN nhấn "Hoàn về" → xóa toàn bộ hóa đơn → quay lại OPEN.

### Ghi thu thanh toán

Trong tab Hóa đơn của kỳ APPROVED/CLOSED:
1. ACCOUNTANT nhấn "Ghi thu" trên một hóa đơn
2. Dialog nhập: số tiền, phương thức thanh toán, thời gian
3. Lưu → trạng thái hóa đơn tự cập nhật (PARTIAL nếu chưa đủ, PAID nếu đủ)
