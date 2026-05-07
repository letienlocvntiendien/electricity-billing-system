# JPA Patterns & Gotchas

Tài liệu này ghi lại các pattern JPA/Hibernate đặc thù của dự án để tránh lặp lại lỗi đã gặp.

## 1. GENERATED COLUMN — meter_reading.consumption

`consumption` là STORED GENERATED COLUMN trong MySQL:
```sql
consumption INT GENERATED ALWAYS AS (current_index - previous_index) STORED
```

Mapping trong Java:
```java
@Column(insertable = false, updatable = false)
private int consumption;
```

**Không bao giờ** set `consumption` trong builder hoặc setter. Chỉ set `previousIndex` và `currentIndex`.

```java
// ✅ Đúng
MeterReading.builder()
    .previousIndex(100)
    .currentIndex(350)
    .build()

// ❌ Sai — sẽ throw exception hoặc bị bỏ qua
MeterReading.builder()
    .consumption(250)  // không có effect, column là insertable=false
    .build()
```

## 2. LazyInitializationException — đã fix

`BillingPeriod.approvedBy` và `accountantVerifiedBy` được đổi sang `FetchType.EAGER`
để `PeriodResponse.from()` có thể gọi `.getFullName()` ngoài transaction.

Nếu thêm `@ManyToOne` mới vào `BillingPeriod` hoặc entity nào khác mà cần truy cập
trong response mapping → dùng `EAGER` hoặc ensure mapping xảy ra trong `@Transactional` context.

## 3. @Transactional boundaries

Tất cả service methods có write đều có `@Transactional`. Controller không có `@Transactional`.

Nếu gặp `LazyInitializationException` ở controller:
- Option A: Đổi `FetchType.LAZY` → `EAGER` (phù hợp khi entity nhỏ, ít row)
- Option B: Thêm `JOIN FETCH` trong repository query
- Option C: Map sang DTO **trong** transaction (trong service, trước khi return)

## 4. Soft delete — customer.active

`Customer` không bị xóa vật lý. Khi `DELETE /customers/{id}`, service set `active = false`.

Khi tạo kỳ mới, `initMeterReadings()` chỉ lấy `customerRepository.findAllByActiveTrue()`.
Customers inactive không được tạo meter_reading cho kỳ mới.

## 5. UNIQUE constraints quan trọng

```sql
UNIQUE (period_id, customer_id)  -- meter_reading
UNIQUE (period_id, customer_id)  -- bill
UNIQUE (payment_code)            -- bill
UNIQUE (bank_transaction_id)     -- payment (idempotency cho SePay webhook)
UNIQUE (code)                    -- billing_period
```

Nếu gặp `DataIntegrityViolationException`, kiểm tra các constraints này trước.

## 6. @Builder.Default fields

Các field có `@Builder.Default` PHẢI được set explicitly trong builder nếu muốn giá trị khác default:

```java
// BillingPeriod
status = PeriodStatus.OPEN      // default — set .status(PeriodStatus.CLOSED) nếu cần

// Bill
status = BillStatus.PENDING     // default — set .status(BillStatus.PAID) nếu paid
paidAmount = BigDecimal.ZERO    // default — set .paidAmount(amount) nếu đã thanh toán

// BillingPeriod
evnTotalAmount = BigDecimal.ZERO
evnTotalKwh = 0
extraFee = BigDecimal.ZERO
```

## 7. FK save order (DataInitializer / tests)

Khi save trực tiếp qua repository (không qua service), đảm bảo thứ tự:
```
user → customer → billing_period → evn_invoice → meter_reading → bill → payment
```

## 8. H2 compatibility (tests)

Test profile dùng H2 với `MODE=MySQL`. Một số MySQL-specific syntax có thể fail:
- Backtick-quoted table name `` `user` `` cần xử lý qua `NON_KEYWORDS=USER` trong URL
- GENERATED COLUMN syntax khác nhau — H2 tests có thể dùng `ddl-auto=create-drop` thay vì Flyway
