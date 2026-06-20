# Prompt: Làm sạch dữ liệu lịch sử tiền điện (2013–2026)

> Đây là tài liệu hướng dẫn dành cho AI thực hiện việc phân tích và làm sạch dữ liệu từ file Excel lịch sử. Đọc toàn bộ tài liệu này trước khi bắt đầu xử lý.

---

## 1. Nhiệm vụ

Bạn sẽ nhận được một file Excel có **124 sheets** chứa toàn bộ lịch sử tiền điện từ năm 2013 đến tháng 05/2026 của một khu phố có khoảng ~70–100 hộ gia đình.

Nhiệm vụ của bạn trong **giai đoạn 1** này là:

1. **Phân tích** toàn bộ file — đọc từng sheet, hiểu cấu trúc, phát hiện bất thường
2. **Làm sạch và chuẩn hóa** dữ liệu theo các quy tắc bên dưới
3. **Báo cáo lỗi** — liệt kê rõ ràng tất cả những gì cần người dùng xem xét thủ công
4. **Không tự ý sửa** dữ liệu nghiệp vụ khi chưa rõ nguyên nhân (xem mục 6)

Chưa cần tạo SQL hay import vào database ở giai đoạn này.

---

## 2. Bối cảnh hệ thống

### 2.1 Nghiệp vụ

Đây là hệ thống quản lý tiền điện nội bộ của một khu phố. Cách hoạt động:

- Toàn bộ khu phố dùng **1 đồng hồ tổng** mua điện từ EVN (công ty điện lực quốc gia)
- Mỗi hộ gia đình có **1 đồng hồ con** riêng
- Mỗi tháng, người ghi điện đi đọc từng đồng hồ con, ghi lại chỉ số
- Ban quản lý tính tiền mỗi hộ dựa trên tiêu thụ × đơn giá + phí ghi điện
- Thu tiền và theo dõi công nợ

### 2.2 Cơ sở dữ liệu đích (target schema)

Dữ liệu sau khi làm sạch sẽ được import vào hệ thống với các bảng sau:

**`customer`** — Danh sách hộ dùng điện
```
code        VARCHAR(20)   -- Mã hộ, format: KH001, KH002, ...
fullName    VARCHAR(200)  -- Họ tên
phone       VARCHAR(20)   -- Số điện thoại (có thể null)
meterSerial VARCHAR(50)   -- Số sê-ri đồng hồ (có thể null)
active      BOOLEAN       -- false nếu hộ đã rời đi
```

**`billing_period`** — Kỳ tính điện (theo tháng)
```
code        VARCHAR(20)   -- Format: "2026-04" (YYYY-MM)
name        VARCHAR(100)  -- Format: "Kỳ tháng 04/2026"
startDate   DATE          -- Ngày đầu kỳ
endDate     DATE          -- Ngày cuối kỳ
unitPrice   DECIMAL(10,2) -- Đơn giá VND/kWh cho kỳ này
serviceFee  DECIMAL(15,2) -- Phí ghi điện (flat fee/hộ)
status      ENUM          -- Lịch sử: dùng CLOSED
```

**`meter_reading`** — Chỉ số công tơ mỗi hộ theo kỳ
```
period_id      FK → billing_period
customer_id    FK → customer
previousIndex  INT  -- Chỉ số kỳ trước
currentIndex   INT  -- Chỉ số kỳ này
consumption    INT  -- GENERATED: currentIndex - previousIndex (DB tự tính)
```

**`bill`** — Hóa đơn mỗi hộ theo kỳ
```
period_id          FK → billing_period
customer_id        FK → customer
consumption        INT           -- Sản lượng kWh
unitPrice          DECIMAL(10,2) -- Snapshot đơn giá tại thời điểm tính
serviceFee         DECIMAL(15,2) -- Snapshot phí ghi điện
electricityAmount  DECIMAL(15,2) -- consumption × unitPrice
serviceAmount      DECIMAL(15,2) -- = serviceFee (flat per hộ)
totalAmount        DECIMAL(15,2) -- electricityAmount + serviceAmount
```

---

## 3. Cấu trúc file Excel

### 3.1 Tổng quan

- **124 sheets** tổng cộng
- **~112 sheets** chứa dữ liệu tiền điện theo tháng (2013–2026)
- **~12 sheets** khác (cần phân loại khi đọc — có thể là danh sách khách hàng, thống kê, v.v.)

### 3.2 Quy ước đặt tên sheet (RẤT KHÔNG nhất quán)

Bảng dưới đây là các ví dụ thực tế từ file. Bạn cần tự nhận dạng pattern:

| Tên sheet thực tế | Diễn giải |
|---|---|
| `232013` | Tháng 2–3/2013 (gộp) hoặc tháng 2/2013? — cần xác định |
| `32014` | Tháng 3/2014 |
| `5215` | Tháng 5/2015 (`52` = tháng 5? hoặc đánh máy nhầm?) |
| `T32018` | Tháng 3/2018 |
| `T42019` | Tháng 4/2019 |
| `T12020` | Tháng 1/2020 |
| `122021` | Tháng 12/2021 |
| `12023` | Tháng 1/2023 |
| `122023` | Tháng 12/2023 |
| `012025` | Tháng 1/2025 |
| `122025` | Tháng 12/2025 |
| `32026` | Tháng 3/2026 |
| `T42026` | Tháng 4/2026 |
| `52026` | Tháng 5/2026 |
| `01va22026` | Tháng 1 và 2/2026 (sheet gộp) |
| `T1+T2/2026` | Tháng 1+2/2026 (sheet gộp) |
| `T10+112021` | Tháng 10+11/2021 (sheet gộp) |
| `Từ T32016đến T42016` | Tháng 3–4/2016 (sheet gộp) |
| `tu t62015 den t22016` | Tháng 6/2015–2/2016 (sheet gộp nhiều tháng) |
| `từ t52016 đến t22017` | Tháng 5/2016–2/2017 (sheet gộp nhiều tháng) |

**Lưu ý quan trọng:** Một số sheet gộp đại diện cho **nhiều tháng liên tiếp** (không phải 1 kỳ). Đây là trường hợp đặc biệt — xem quy tắc xử lý ở mục 4.1.

### 3.3 Cấu trúc cột trong mỗi sheet billing

Tên cột có thể khác nhau giữa các sheet (viết tắt, thêm dòng trống, v.v.) nhưng thứ tự và ý nghĩa thường nhất quán:

| Cột gốc trong Excel | Ý nghĩa | Ánh xạ DB |
|---|---|---|
| `STT` hoặc `TT` | Số thứ tự dòng | Bỏ qua |
| `Họ tên` | Tên hộ/người dùng điện | `customer.fullName` |
| `Chỉ số cũ` | Chỉ số đồng hồ kỳ trước | `meter_reading.previousIndex` |
| `Chỉ số mới` | Chỉ số đồng hồ kỳ này | `meter_reading.currentIndex` |
| `Số trong tháng` | Sản lượng tiêu thụ (kWh) | `meter_reading.consumption` *(kiểm tra: phải = mới − cũ)* |
| `Đơn giá` | Giá điện VND/kWh | `billing_period.unitPrice` |
| `Thành tiền` | Tiêu thụ × đơn giá | `bill.electricityAmount` |
| `Công ghi điện` | Phí ghi điện/phí dịch vụ | `billing_period.serviceFee` |
| `Tổng thanh toán` | Thành tiền + công | `bill.totalAmount` |
| `Ký nộp` | Trạng thái nộp tiền | Chỉ tham khảo, không import |

**Lưu ý cột `Chỉ số mới`:** Có sheet có 2 cột đều ghi "Chỉ số mới" — xác định cột nào là chỉ số thực tế, cột nào là trùng lặp/lỗi header.

---

## 4. Quy tắc làm sạch

### 4.1 Parse tên sheet → Billing Period

**Bước 1:** Đọc tất cả tên sheet, phân loại thành:
- **Single-month sheet**: đại diện đúng 1 tháng → chuẩn hóa thành `YYYY-MM`
- **Multi-month sheet**: đại diện cho 2+ tháng → FLAG riêng (xem dưới)
- **Non-billing sheet**: không phải dữ liệu tiền điện → ghi nhận và mô tả nội dung

**Bước 2:** Chuẩn hóa tên sheet single-month:
- Loại bỏ tiền tố `T`, `t`
- Xác định tháng (1–12) và năm (2013–2026)
- Output format: `YYYY-MM` (ví dụ: `T42026` → `2026-04`)

**Bước 3:** Xử lý multi-month sheets:
- Liệt kê rõ: tên sheet, khoảng thời gian, số dòng dữ liệu
- Cố gắng xác định xem sheet có **phân biệt từng tháng** trong nội dung không (có cột tháng, có phân cách, v.v.)
- Nếu không phân biệt được: FLAG để người dùng quyết định
- **Không tự động tách** thành nhiều kỳ nếu không chắc chắn

### 4.2 Chuẩn hóa tên khách hàng

Đây là bước **quan trọng nhất** vì tên khách hàng thay đổi cách viết qua các năm.

**Quy trình:**
1. Thu thập tất cả giá trị cột `Họ tên` từ mọi sheet
2. Chuẩn hóa cơ bản: trim khoảng trắng, chuẩn hóa Unicode (NFC), bỏ dấu thừa
3. Xây dựng danh sách **unique names** xuyên suốt toàn bộ file
4. Thực hiện **fuzzy matching** để gom các cách viết khác nhau của cùng 1 người
5. Gán **provisional code** tạm: KH001, KH002, ... (sắp xếp theo thứ tự xuất hiện sớm nhất)

**Các trường hợp cần flag:**
- Hai tên có độ tương đồng cao (>80%) nhưng chưa chắc là cùng người → FLAG `POSSIBLE_DUPLICATE`
- Tên chỉ xuất hiện trong 1–2 sheet rồi biến mất → FLAG `POSSIBLE_LEAVER` (hộ đã rời đi)
- Tên mới xuất hiện từ một thời điểm nào đó → FLAG `POSSIBLE_NEWCOMER`

**Không được gom tự động** nếu không chắc chắn — thà flag quá nhiều còn hơn gom nhầm.

### 4.3 Kiểm tra tính nhất quán chỉ số công tơ

Với mỗi dòng trong sheet:

**Check A — Nội bộ dòng:**
```
consumption_excel = currentIndex - previousIndex
```
- Nếu `consumption_excel != "Số trong tháng"` trong Excel: FLAG `CONSUMPTION_MISMATCH`
- Nếu `currentIndex < previousIndex`: FLAG `INDEX_REVERSED` (không tự sửa)
- Nếu `previousIndex < 0` hoặc `currentIndex < 0`: FLAG `NEGATIVE_INDEX`

**Check B — Liên tháng (cross-period):**
Với cùng 1 khách hàng, `currentIndex` của tháng T phải ≈ `previousIndex` của tháng T+1:
- Nếu lệch nhiều (>0): FLAG `INDEX_GAP` với giá trị chênh lệch
- Nếu tháng T+1 có `previousIndex` nhỏ hơn đáng kể (có thể đổi đồng hồ): FLAG `METER_RESET`

### 4.4 Xử lý giá trị âm và bất thường

**Giá trị tiêu thụ âm (`Số trong tháng < 0`):**
- FLAG với tag: `NEGATIVE_CONSUMPTION`
- Ghi lại: sheet, tên KH, previousIndex, currentIndex, giá trị âm
- Nguyên nhân có thể: nhập sai chỉ số, đổi đồng hồ, đảo cột, điều chỉnh nợ

**Giá trị tiền âm (`Thành tiền < 0` hoặc `Tổng thanh toán < 0`):**
- FLAG với tag: `NEGATIVE_AMOUNT`
- Có thể là hoàn tiền/điều chỉnh có chủ đích — không tự sửa

**Ví dụ đã biết cần flag:**

| Sheet | Khách hàng | Số trong tháng | Thành tiền |
|---|---|---|---|
| T42026 | Bích | -30 | -110,940 |
| T42026 | Việt | -197 | -728,506 |
| t32019 | Hùng Tuấn | -12,818 | (kiểm tra) |

**Tiêu thụ bất thường cao (outlier):**
- Nếu tiêu thụ > 3× median của hộ đó trong các tháng khác: FLAG `HIGH_CONSUMPTION_OUTLIER`
- Không tự sửa — chỉ để người dùng xem xét

### 4.5 Xử lý dữ liệu thiếu

| Trường hợp | Cách xử lý |
|---|---|
| Dòng không có tên KH | Bỏ qua (thường là dòng tổng, header phụ, dòng trống) |
| Tên KH có nhưng chỉ số trống | FLAG `MISSING_INDEX` |
| Chỉ số có nhưng "Số trong tháng" trống | Tính lại từ currentIndex - previousIndex |
| "Đơn giá" trống ở 1 dòng | Lấy từ các dòng khác trong cùng sheet (thường đồng nhất) |
| "Đơn giá" trống cả sheet | FLAG `MISSING_UNIT_PRICE` |
| "Thành tiền" trống | Tính lại = consumption × unitPrice nếu đủ dữ liệu |
| "Công ghi điện" trống | Dùng 0, ghi chú `SERVICE_FEE_UNKNOWN` |

### 4.6 Kiểm tra đơn giá và phí ghi điện

**Đơn giá (`Đơn giá`):**
- Thường giống nhau cho tất cả hộ trong cùng 1 sheet → lấy giá trị đại diện (mode hoặc max)
- Nếu có hộ có đơn giá khác: FLAG `UNIT_PRICE_INCONSISTENT`
- Đơn giá điện Việt Nam tăng dần theo năm (khoảng 1,300–2,000 VND/kWh giai đoạn 2013–2026). Nếu đơn giá ngoài khoảng này: FLAG `UNIT_PRICE_SUSPICIOUS`

**Phí ghi điện (`Công ghi điện`):**
- Xác định đây là **flat fee** (số tiền cố định/hộ) hay **% của thành tiền**
- Nếu flat fee: ghi nhận giá trị và kiểm tra có nhất quán không
- Nếu có hộ có phí khác nhau trong cùng sheet: FLAG `SERVICE_FEE_INCONSISTENT`

---

## 5. Xử lý sheet gộp nhiều tháng

Đây là trường hợp đặc biệt cần xử lý cẩn thận:

**Các sheet đã biết là gộp nhiều tháng:**
- `01va22026` → tháng 1 và 2/2026
- `T1+T2/2026` → tháng 1+2/2026
- `T10+112021` → tháng 10+11/2021
- `Từ T32016đến T42016` → tháng 3–4/2016
- `tu t62015 den t22016` → tháng 6/2015 đến 2/2016
- `từ t52016 đến t22017` → tháng 5/2016 đến 2/2017
- `232013` → có thể là tháng 2–3/2013

**Cách xử lý:**
1. Đọc nội dung sheet, xem có phân biệt từng tháng không (header phụ, nhóm dữ liệu riêng, v.v.)
2. Nếu sheet có thể tách rõ ràng từng tháng: thực hiện tách, ghi nhận vào report
3. Nếu không tách được: ghi nhận vào FLAG report với đầy đủ context để người dùng xử lý thủ công
4. **Không bỏ qua** các sheet này — dữ liệu vẫn có giá trị

---

## 6. Những gì KHÔNG được tự động sửa

Đây là danh sách các trường hợp mà bạn **chỉ được FLAG, không được tự sửa**:

| Loại vấn đề | Lý do không tự sửa |
|---|---|
| Tiêu thụ âm | Có thể là điều chỉnh nghiệp vụ có chủ đích (hoàn tiền, bù trừ) |
| Chỉ số đảo (current < previous) | Có thể do đổi đồng hồ — người dùng phải xác nhận previousIndex mới |
| Tên khách hàng nghi trùng | Có thể là 2 người trùng tên thật, hoặc 1 người viết khác — cần xác nhận |
| Sheet gộp nhiều tháng không tách được | Cần người dùng quyết định cách xử lý nghiệp vụ |
| Đơn giá ngoài khoảng hợp lý | Có thể là đơn giá đặc biệt, không phải lỗi |
| Công ghi điện không nhất quán | Có thể là điều chỉnh cá biệt có lý do |

---

## 7. Output yêu cầu

Tạo ra các file sau:

### 7.1 `customers.csv` — Danh sách khách hàng unique

```csv
provisional_code,name_normalized,name_variants,first_seen_period,last_seen_period,total_periods,status,flags
KH001,"Nguyễn Văn An","Nguyễn Văn An|NV An|N.V. An",2013-03,2026-04,150,ACTIVE,
KH002,"Trần Thị Bình","Trần Thị Bình|T Bình",2013-03,2025-12,148,INACTIVE,POSSIBLE_LEAVER
...
```

### 7.2 `billing_periods.csv` — Danh sách kỳ tính điện

```csv
period_code,sheet_name,unit_price,service_fee,num_customers,is_multi_month,flags
2026-04,T42026,3200,15000,71,,
2026-01,01va22026,,,,TRUE,MULTI_MONTH_SHEET
...
```

### 7.3 `meter_readings.csv` — Chỉ số công tơ đã chuẩn hóa

```csv
period_code,customer_provisional_code,previous_index,current_index,consumption_excel,consumption_calculated,unit_price,electricity_amount,service_fee,total_amount,flags
2026-04,KH001,12500,12620,120,120,3200,384000,15000,399000,
2026-04,KH002,8430,8233,-197,-197,3700,-728506,15000,-713506,NEGATIVE_CONSUMPTION
...
```

### 7.4 `flag_report.csv` — Toàn bộ các dòng cần xem xét thủ công

```csv
flag_type,severity,sheet_name,period_code,customer_name,customer_provisional_code,detail,previous_index,current_index,consumption,amount
NEGATIVE_CONSUMPTION,HIGH,T42026,2026-04,Việt,KH045,"Tiêu thụ âm -197 kWh",,,-197,-728506
POSSIBLE_DUPLICATE,MEDIUM,,,"Nguyễn Văn An" vs "Nguyen Van An",,Xuất hiện song song từ 2020-01,,,,,
MULTI_MONTH_SHEET,MEDIUM,T1+T2/2026,,,,Không tách được theo tháng,,,,,
...
```

### 7.5 `summary_report.md` — Báo cáo tổng hợp

Bao gồm:
- Tổng số sheets: x (x single-month, x multi-month, x non-billing)
- Thời gian bao phủ: YYYY-MM đến YYYY-MM
- Tổng số hộ unique (provisional): x
- Tổng số kỳ billing parse được: x
- Tổng số dòng dữ liệu: x
- Tổng số flags: x (phân loại theo flag_type)
- Danh sách các vấn đề nghiêm trọng nhất cần xem xét ngay
- Danh sách multi-month sheets với khoảng thời gian

---

## 8. Thứ tự thực hiện khuyến nghị

1. Đọc và liệt kê toàn bộ tên sheets
2. Phân loại sheets: single-month / multi-month / non-billing
3. Xây dựng danh sách unique customers từ toàn bộ file
4. Xử lý từng single-month sheet: parse, chuẩn hóa, check, flag
5. Xử lý multi-month sheets riêng
6. Tổng hợp output files

---

## 9. Lưu ý kỹ thuật

- File Excel có thể có encoding đặc biệt cho tiếng Việt (Unicode NFC/NFD) — xử lý cẩn thận khi compare tên
- Số trong Excel có thể lưu dạng text (với dấu phẩy ngàn) hoặc number — cần parse nhất quán
- Một số sheet có thể có nhiều header rows hoặc merged cells — cần detect và skip
- Dòng tổng cộng (thường ở cuối sheet, không có tên KH hoặc có tên "Cộng", "Tổng") cần bỏ qua
- Giá trị tiền có thể có định dạng `1.234.567` hoặc `1,234,567` — cần chuẩn hóa

---

*Tài liệu này được tạo để hỗ trợ import dữ liệu lịch sử vào hệ thống Electricity Billing System. Sau khi người dùng review flag report và xác nhận dữ liệu sạch, giai đoạn 2 sẽ là tạo SQL INSERT statements để đưa vào database.*
