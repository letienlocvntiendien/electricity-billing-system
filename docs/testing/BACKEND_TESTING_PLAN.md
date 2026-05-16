# Backend Testing Plan

Tai lieu nay mo ta ke hoach bo sung test nghiep vu backend cho Electricity Billing
System. Muc tieu la bat dau tu nhung test co gia tri cao nhat, de viet va de bao
tri, chua phuc tap hoa bang Testcontainers, coverage gate, performance test hay
kiem thu PDF chi tiet.

## 1. Muc Tieu

Backend hien tai moi co smoke test `contextLoads`, nen chua du bao ve cac luong
co rui ro cao ve tien, trang thai ky dien va phan quyen. Vong dau tien can them
test cho cac phan sau:

- Cong thuc tinh tien dien.
- Vong doi ky thanh toan.
- Phan quyen theo vai tro.
- SePay webhook matching va idempotency.
- Ghi thu partial/over payment.
- Dong ky va hoan ve ky.
- Trang thai sinh PDF/QR.

Tieu chi thanh cong: `./mvnw test` pass on dinh, cac test doc duoc nhu tai lieu
song cua nghiep vu, khong can database/AWS/SePay that.

## 2. Nguyen Tac Vong Dau

- Giu stack test hien tai: JUnit, Spring Boot Test, H2 profile `test`.
- Uu tien test nghiep vu, khong chay theo phan tram coverage.
- Khong them Testcontainers trong vong dau.
- Khong mock qua nhieu neu co the dung service va repository that voi H2.
- Moi test nen co ten ro rang theo dang `should...when...`.
- Neu test lam lo bug hien tai, ghi nhan bug va sua o task rieng neu thay doi
  behavior lon.
- Tranh tao fixture framework lon; chi can helper nho de tao user, customer,
  period, reading, invoice, bill va payment.

## 3. Thu Tu Trien Khai

### Buoc 1: Calculation Unit Tests

Loai test: unit test, khong can Spring context.

Class goi y:

- `CalculationEngineTest`

Test toi thieu:

- Tinh dung `unitPrice = (evnTotalAmount + extraFee) / totalConsumption`.
- `serviceFee` la phi flat moi ho, khong nhan voi kWh.
- `electricityAmount` lam tron ve 0 decimal theo `HALF_UP`.
- Bill co tong tien bang 0 thi status la `PAID`.
- Tong consumption bang 0 thi throw `ZERO_CONSUMPTION`.

Day la nhom test nen lam dau tien vi nhanh, it setup va bao ve loi nghiep vu
quan trong nhat.

### Buoc 2: Period Lifecycle Service Tests

Loai test: Spring Boot integration test voi H2, goi service truc tiep.

Class goi y:

- `PeriodServiceTest`

Test toi thieu:

- Tao ky moi voi customer active thi sinh meter reading slot.
- `calculate` fail neu ky chua o `READING_DONE`.
- `calculate` fail neu chua co EVN invoice.
- Luong hop le: `OPEN -> READING_DONE -> CALCULATED -> verify -> APPROVED`.
- `approve` fail neu chua co accountant verification.
- `close` fail neu con bill chua `PAID`.
- `close` thanh cong khi tat ca bill da `PAID`.
- `revert` tu `CALCULATED` xoa bills, clear `unitPrice`, clear verify fields va dua status ve `OPEN`.
- `revert` tu `APPROVED` clear approve fields va dua status ve `OPEN`.

Ghi chu: Neu muon giu vong dau that gon, chua can test moi canh cua date overlap
hay customer deactivate.

### Buoc 3: Payment Service Tests

Loai test: Spring Boot integration test voi H2, goi service truc tiep.

Class goi y:

- `PaymentServiceTest`

Test toi thieu:

- Ghi thu mot phan thi bill chuyen sang `PARTIAL`.
- Ghi thu du tien thi bill chuyen sang `PAID`.
- Ghi thu vuot tong tien van chuyen sang `PAID`.
- Khong cho ghi thu them neu bill da `PAID`.
- Assign unmatched payment vao bill thi cap nhat `paidAmount` va status.
- Khong cho assign payment da duoc gan vao bill khac.

Pham vi vong dau khong can xu ly refund, cancel payment hay doi soat phuc tap.

### Buoc 4: SePay Webhook Tests

Loai test: Spring Boot integration test voi H2, goi `SepayWebhookService` truc tiep.

Class goi y:

- `SepayWebhookServiceTest`

Test toi thieu:

- `transferType` khac `in` thi bo qua, khong tao payment.
- Noi dung co payment code dung thi match vao bill.
- Payment code khong phan biet hoa thuong.
- Giao dich trung SePay id thi khong tao payment lan hai.
- Noi dung khong match bill nao thi tao unmatched payment voi `bill = null`.
- So tien chua du thi bill thanh `PARTIAL`.
- So tien du hoac vuot tong tien thi bill thanh `PAID`.

Khong can goi HTTP endpoint webhook o vong dau; test service la du de khoa nghiep
vu matching va idempotency.

### Buoc 5: Permission Matrix Tests

Loai test: MockMvc/Spring Boot integration test.

Class goi y:

- `SecurityPermissionTest`

Huong tiep can:

- Tao user that trong H2 cho 3 role: `ADMIN`, `ACCOUNTANT`, `METER_READER`.
- Dang nhap qua `/api/auth/login` de lay JWT.
- Goi mot tap endpoint dai dien bang Bearer token.

Test toi thieu:

- Khong token goi `/api/periods` thi bi chan.
- `ADMIN` tao period duoc.
- `ACCOUNTANT` khong tao/approve/revert/close period.
- `ACCOUNTANT` duoc goi calculate va verify neu state hop le.
- `METER_READER` duoc submit readings.
- `METER_READER` khong duoc xem bills, payments unmatched, reports, settings.
- `ADMIN` va `ACCOUNTANT` duoc xem bills va reports.

Khong can test tat ca endpoint trong vong dau. Chi can endpoint dai dien cho moi
nhom quyen de tranh test qua mong manh.

### Buoc 6: PDF/QR Status Smoke Test

Loai test: Spring Boot integration test, uu tien test service.

Class goi y:

- `BillGenerationServiceTest`

Test toi thieu:

- Sau khi generate PDF/QR cho period co bill, bill co `qrCodeUrl`.
- Bill co `pdfUrl` va file duoc tao trong `target/test-uploads`.
- Bill `PENDING` chuyen sang `SENT` theo behavior hien tai.
- Neu mot bill loi sinh PDF thi cac bill khac van tiep tuc duoc xu ly.

Khong can test layout PDF, font, QR image render hay noi dung file PDF trong vong
dau. Nhung phan do nen de cho task rieng neu can nghiem thu hoa don in.

## 4. Fixture Va Setup Toi Thieu

Nen them mot helper nho trong test source, vi cac service test se lap lai nhieu
setup entity.

Class goi y:

- `TestFixtures`

Helper toi thieu:

- `admin()`, `accountant()`, `meterReader()`.
- `customer(code, name)`.
- `openPeriod(code)`.
- `evnInvoice(period, kwh, amount)`.
- `submittedReading(period, customer, previousIndex, currentIndex, reader)`.
- `bill(period, customer, totalAmount, status)`.
- `payment(amount, billOrNull)`.

Nguyen tac:

- Helper chi tao object/entity don gian.
- Khong an logic nghiep vu quan trong trong helper.
- Neu test can minh bach state transition, nen set state ngay trong test thay vi
  giau het trong fixture.

## 5. Acceptance Checklist

Hoan tat vong dau khi dat du cac diem sau:

- Co test cho `CalculationEngine`.
- Co test service cho lifecycle chinh cua `PeriodService`.
- Co test service cho partial/paid/over payment.
- Co test service cho SePay matched, unmatched va duplicate transaction.
- Co test MockMvc cho role access dai dien.
- Co smoke test cho PDF/QR status.
- `./mvnw test` pass.
- Test khong phu thuoc MySQL, AWS, SePay that hoac file local ngoai `target/`.

## 6. Viec Chua Lam Trong Vong Dau

Cac viec sau co gia tri, nhung nen de sau khi da co bo test co ban:

- Testcontainers voi MySQL that.
- Coverage threshold trong CI.
- Snapshot/noi dung chi tiet cua PDF.
- E2E test tu frontend den backend.
- Performance test cho sinh PDF hang loat.
- Security hardening test nhu brute force login, CSP, XSS.
- Contract test voi SePay payload that.

## 7. Lenh Chay

Chay toan bo backend test:

```bash
./mvnw test
```

Neu can chay mot test class:

```bash
./mvnw -Dtest=CalculationEngineTest test
```

Neu test sinh file PDF/QR, chi ghi vao:

```text
target/test-uploads
```

## 8. Permission Matrix

Expected HTTP status by role for representative endpoints.
`2xx/4xx` = authorized (correct role), may still fail on business logic — but NOT 403.

| Endpoint | ADMIN | ACCOUNTANT | METER_READER | No Token |
|---|---|---|---|---|
| `POST /api/auth/login` | 200 | 200 | 200 | 200 |
| `GET /api/periods` | 200 | 200 | 200 | **401** |
| `POST /api/periods` | 201 | **403** | **403** | **401** |
| `PATCH /api/periods/{id}` | 200 | 200 | **403** | **401** |
| `POST /api/periods/{id}/submit-readings` | **403** | **403** | 2xx/4xx | **401** |
| `POST /api/periods/{id}/calculate` | 2xx/4xx | 2xx/4xx | **403** | **401** |
| `POST /api/periods/{id}/verify` | 2xx/4xx | 2xx/4xx | **403** | **401** |
| `POST /api/periods/{id}/approve` | 2xx/4xx | **403** | **403** | **401** |
| `POST /api/periods/{id}/revert` | 2xx/4xx | **403** | **403** | **401** |
| `POST /api/periods/{id}/close` | 2xx/4xx | **403** | **403** | **401** |
| `GET /api/customers` | 200 | 200 | 200 | **401** |
| `POST /api/customers` | 201 | **403** | **403** | **401** |
| `PATCH /api/customers/{id}` | 200 | **403** | **403** | **401** |
| `DELETE /api/customers/{id}` | 200 | **403** | **403** | **401** |
| `GET /api/periods/{id}/readings` | 200 | 200 | 200 | **401** |
| `PATCH /api/readings/{id}` | 200 | 200 | 200 | **401** |
| `GET /api/periods/{id}/evn-invoices` | 200 | 200 | **403** | **401** |
| `POST /api/periods/{id}/evn-invoices` | 201 | 201 | **403** | **401** |
| `GET /api/bills` | 200 | 200 | **403** | **401** |
| `POST /api/bills/{id}/payments` | 2xx/4xx | 2xx/4xx | **403** | **401** |
| `GET /api/payments/unmatched` | 200 | 200 | **403** | **401** |
| `POST /api/payments/{id}/assign` | 2xx/4xx | 2xx/4xx | **403** | **401** |
| `GET /api/settings` | 200 | 200 | **403** | **401** |
| `PATCH /api/settings/{key}` | 2xx/4xx | **403** | **403** | **401** |
| `GET /api/reports/debt` | 200 | 200 | **403** | **401** |
| `GET /api/reports/period/{id}` | 200 | 200 | **403** | **401** |
| `POST /api/webhooks/sepay` | — | — | — | 200 (Apikey header) |

> Note: `POST /api/periods/{id}/submit-readings` has `@PreAuthorize("hasRole('METER_READER')")` — ADMIN is **not** allowed. Verify in `PeriodController.java` line 187 if this is intentional.
