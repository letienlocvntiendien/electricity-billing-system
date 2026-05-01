# Plan: Dev-Profile Seed Data Initializer

## Context

All 4 sprints of the backend are complete and tests pass. The developer needs realistic seed data to exercise every API endpoint via Postman without manually inserting records. No seeder exists today.

**Goal:** A single `DataInitializer.java` Spring component (`@Profile("dev")`) that creates 3 users, 10 customers, 3 billing periods in different lifecycle states, matching meter readings, EVN invoices, bills, and payments on first startup — idempotent on restart.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/main/java/com/loc/electricity/config/DataInitializer.java` | Spring `ApplicationRunner` that seeds all data |
| `src/main/resources/application-dev.properties` | Dev-profile property overrides |

No existing files need modification.

---

## `application-dev.properties`

```properties
# Dev overrides — applied on top of application.properties
spring.jpa.show-sql=true
spring.task.scheduling.pool.size=0
app.jwt.access-token-expiration-ms=3600000
app.upload.dir=uploads-dev
```

`spring.task.scheduling.pool.size=0` disables `OverdueScheduler` so seeded bill statuses stay frozen across restarts (all historical period approvedAt dates are in 2025, well past the 30-day cutoff).

---

## `DataInitializer.java` — Structure

```java
@Component @Profile("dev") @RequiredArgsConstructor @Slf4j
public class DataInitializer implements ApplicationRunner {
    // all 8 repositories + PasswordEncoder injected

    @Override @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.findByUsername("admin").isPresent()) {
            log.info("[DataInitializer] Seed data already present — skipping.");
            return;
        }
        Map<String, User> users = seedUsers();
        List<Customer> customers = seedCustomers();
        seedSystemSettings();
        seedPeriod1(customers, users);   // CLOSED
        seedPeriod2(customers, users);   // APPROVED
        seedPeriod3(customers, users);   // OPEN, partial readings
        log.info("[DataInitializer] Dev seed complete.");
    }
}
```

Each `seedXxx()` is a private helper. Amount arithmetic is inline (do NOT call `PeriodService`, `PaymentService`, or `CalculationEngine` — those fire audit events and enforce state machine rules).

---

## Seed Data Scenario

### Users

| username    | password     | role          | fullName                          |
|-------------|--------------|---------------|-----------------------------------|
| `admin`     | `Admin@123`  | `ADMIN`       | Quản trị viên                     |
| `accountant`| `Account@123`| `ACCOUNTANT`  | Kế toán Nguyễn Thị Hoa            |
| `reader`    | `Reader@123` | `METER_READER`| Thợ đọc đồng hồ Trần Văn Minh    |

Use `passwordEncoder.encode(...)` — never hardcode BCrypt hashes.

### Customers (10)

Codes `KH001`–`KH010`, Vietnamese names, phones `090123450X`, meter serials `DK-00X-Y`, all `active=true`. KH007 has no `zaloPhone` (null) to test the missing-Zalo edge case.

### System Settings

Update two rows already present from V1 migration:
- `bank_account_number` → `"00012345678910"`
- `bank_account_holder` → `"NGUYEN VAN AN"`

Use `systemSettingRepository.findById(key).ifPresent(s -> { s.setSettingValue(...); systemSettingRepository.save(s); })`.

---

### Period 1 — `2025-02` — **CLOSED**

- name: `"Kỳ tháng 02/2025"`, dates: 2025-02-01 → 2025-02-28
- EVN invoice: `4819 kWh`, `7,546,419 VND` (matches spec worked example → unitPrice = 1566)
- `serviceUnitPrice = 500`, `extraFee = 0`
- `status = CLOSED`, `approvedBy = admin`, `approvedAt = 2025-02-10T09:00`, `closedAt = 2025-02-28T17:00`

**Readings** — all 10 submitted (`readAt` not null, `readBy = reader`):

| Customer | previousIndex | currentIndex | consumption |
|----------|--------------|--------------|-------------|
| KH001 | 0 | 480 | 480 |
| KH002 | 0 | 512 | 512 |
| KH003 | 0 | 445 | 445 |
| KH004 | 0 | 523 | 523 |
| KH005 | 0 | 498 | 498 |
| KH006 | 0 | 412 | 412 |
| KH007 | 0 | 534 | 534 |
| KH008 | 0 | 476 | 476 |
| KH009 | 0 | 467 | 467 |
| KH010 | 0 | 472 | 472 |

Total = 4819 kWh ✓

**Bill amounts** — `electricity = consumption × 1566`, `service = consumption × 500`, `total = electricity + service`:

| Customer | total       | paidAmount  | status    |
|----------|-------------|-------------|-----------|
| KH001    | 991,680     | 991,680     | PAID      |
| KH002    | 1,057,792   | 1,057,792   | PAID      |
| KH003    | 919,370     | 919,370     | PAID      |
| KH004    | 1,080,518   | 1,080,518   | PAID      |
| KH005    | 1,028,868   | 1,028,868   | PAID      |
| KH006    | 851,192     | 425,596     | PARTIAL   |
| KH007    | 1,103,244   | 551,622     | PARTIAL   |
| KH008    | 983,416     | 491,708     | PARTIAL   |
| KH009    | 964,822     | 0           | OVERDUE   |
| KH010    | 975,152     | 0           | OVERDUE   |

`paymentCode` = `"TIENDIEN 2025-02 KHxxx"`. 8 `Payment` rows (5 full BANK_TRANSFER/CASH + 3 partial CASH), all `recordedBy = accountant`.

---

### Period 2 — `2025-03` — **APPROVED**

- name: `"Kỳ tháng 03/2025"`, dates: 2025-03-01 → 2025-03-31
- EVN: `5100 kWh`, `8,000,000 VND`; `extraFee = 100,000`; unitPrice = `round((8,000,000 + 100,000) / 5100)` = **1588**
- `serviceUnitPrice = 500`
- `status = APPROVED`, `approvedBy = admin`, `approvedAt = 2025-03-10T09:00`

**Readings** — all 10 submitted; `previousIndex` = P1 `currentIndex` (meter continuity):

| Customer | prev | current | consumption |
|----------|------|---------|-------------|
| KH001 | 480 | 990 | 510 |
| KH002 | 512 | 1035 | 523 |
| KH003 | 445 | 906 | 461 |
| KH004 | 523 | 1063 | 540 |
| KH005 | 498 | 1013 | 515 |
| KH006 | 412 | 833 | 421 |
| KH007 | 534 | 1090 | 556 |
| KH008 | 476 | 966 | 490 |
| KH009 | 467 | 951 | 484 |
| KH010 | 472 | 1072 | 600 |

Total = 5100 kWh ✓

**Bills** — unitPrice 1588, serviceUnitPrice 500:

| Customer | total       | paidAmount  | status  | notes |
|----------|-------------|-------------|---------|-------|
| KH001    | 1,064,880   | 1,064,880   | PAID    |       |
| KH002    | 1,092,024   | 1,092,024   | PAID    |       |
| KH003    | 962,568     | 962,568     | PAID    |       |
| KH004    | 1,127,520   | 0           | PENDING |       |
| KH005    | 1,075,320   | 0           | PENDING |       |
| KH006    | 879,048     | 439,524     | PARTIAL |       |
| KH007    | 1,160,928   | 580,464     | PARTIAL |       |
| KH008    | 1,023,120   | 0           | PENDING |       |
| KH009    | 1,010,592   | 0           | PENDING |       |
| KH010    | 1,252,800   | 0           | SENT    | `sentViaZalo=true`, `sentAt=2025-03-12T09:00` |

5 Payment rows (KH001–KH003 BANK/CASH, KH006–KH007 partial) + **1 unmatched** Payment (`bill=null`, `amount=500,000`, `bankTransactionId="TXN-UNMATCHED-202503"`).

---

### Period 3 — `2025-04` — **OPEN**

- name: `"Kỳ tháng 04/2025"`, dates: 2025-04-01 → 2025-04-30
- `evnTotalAmount = 0`, `evnTotalKwh = 0`, `unitPrice = null`, `serviceUnitPrice = 500`, `status = OPEN`

**Readings** — 10 rows inserted (as `createPeriod` would do), 6 submitted, 4 still null:

| Customer | prev | current | readAt |
|----------|------|---------|--------|
| KH001 | 990 | 1488 | 2025-04-07T08:10 (reader) |
| KH002 | 1035 | 1562 | 2025-04-07T08:35 |
| KH003 | 906 | 1355 | 2025-04-07T09:05 |
| KH004 | 1063 | 1594 | 2025-04-07T09:30 |
| KH005 | 1013 | 1521 | 2025-04-07T10:00 |
| KH006 | 833 | 1248 | 2025-04-07T10:20 |
| KH007 | 1090 | 1090 | **null** (not submitted) |
| KH008 | 966 | 966 | **null** |
| KH009 | 951 | 951 | **null** |
| KH010 | 1072 | 1072 | **null** |

Unsubmitted rows have `currentIndex = previousIndex` (consumption = 0 generated by DB). No bills for P3.

---

## Critical Implementation Notes

1. **`MeterReading.consumption`** is `@Column(insertable=false, updatable=false)` — DB generates it. Never call `.consumption(...)` in the builder; just set `previousIndex` and `currentIndex`.

2. **`@Builder.Default` fields** that must be explicitly overridden in the builder:
   - `BillingPeriod.status` defaults to `OPEN` — set `.status(PeriodStatus.CLOSED)` for P1
   - `Bill.status` defaults to `PENDING` — set explicitly for PAID/PARTIAL/OVERDUE/SENT bills
   - `Bill.paidAmount` defaults to `BigDecimal.ZERO` — set explicitly for partially/fully paid bills

3. **Bill `paymentCode`** format: `"TIENDIEN " + period.code + " " + customer.code` (e.g., `"TIENDIEN 2025-02 KH001"`).

4. **Payment `bankTransactionId`** must be globally unique across all seeded payments; CASH payments use `null`.

5. **Do NOT call service layer methods** (`PeriodService`, `PaymentService`, etc.) — they enforce state machine rules and fire audit events. Save directly via repositories.

6. **Save ordering** (FK constraint order): `user` → `customer` → `billing_period` → `evn_invoice` → `meter_reading` → `bill` → `payment`.

---

## Running with Dev Profile

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

**Verify seed ran:** log line `[DataInitializer] Dev seed complete.`  
**Verify idempotent:** restart → log line `[DataInitializer] Seed data already present — skipping.`

---

## Postman Coverage Enabled by This Data

| Scenario | Data |
|----------|------|
| Login as all 3 roles | `admin/Admin@123`, `accountant/Account@123`, `reader/Reader@123` |
| Customer CRUD | 10 customers |
| Period list across all statuses | P1=CLOSED, P2=APPROVED, P3=OPEN |
| Submit missing readings | P3 has 4 un-submitted readings |
| Add EVN invoice + calculate P3 | No EVN invoice yet on P3 |
| Approve / close P3 after calc | Flows through full lifecycle |
| Bill states variety | PAID, PARTIAL, OVERDUE, PENDING, SENT all present in P2 |
| Add manual payment | P2 KH004/KH005/KH008/KH009 are PENDING |
| Assign unmatched payment | 1 unmatched payment in P2 |
| Debt report | P1 KH009/KH010 OVERDUE; P2 multiple PENDING |
| Period summary report | P1 fully closed, P2 mixed |
| Settings update | Bank account fields need real values |
