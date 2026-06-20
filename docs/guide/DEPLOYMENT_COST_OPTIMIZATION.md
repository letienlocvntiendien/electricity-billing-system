# Tối ưu chi phí triển khai

## Bối cảnh & Vấn đề

App điện chỉ được sử dụng **3-4 lần/tháng** (theo chu kỳ kỳ điện). Chạy VPS/EC2 liên tục 24/7 là lãng phí.

Ràng buộc khó nhất: **SePay webhook** (`POST /api/webhooks/sepay`) phải luôn sẵn sàng vì khách hàng chuyển khoản bất kỳ lúc nào trong tháng — không thể tắt hoàn toàn.

### Tại sao không tách webhook ra Lambda riêng?

`SepayWebhookService` thực hiện nhiều thao tác phức tạp:
- Deduplication check (`existsByBankTransactionId`)
- Parse payment code bằng regex
- Lookup và update `bill` + `payment` + `audit_log`
- Publish audit event

Duplicate toàn bộ logic JPA này sang Lambda (Node.js/Python) là không thực tế.

---

## Kiến trúc được đề xuất: Fly.io + UptimeRobot

```
                    ┌─────────────────────────────┐
Internet ──────────▶│  Fly.io Machine              │
(SePay, Admin)      │  Spring Boot container        │
                    │                               │
                    │  auto_stop  = suspend (idle)  │
                    │  auto_start = true            │
                    │  min_machines = 0             │
                    └──────────────┬────────────────┘
                                   │ connects to
                                   ▼
                    ┌─────────────────────────────┐
                    │  Cloud Database (MySQL)       │
                    │  (giữ nguyên, không thay đổi)│
                    └─────────────────────────────┘

UptimeRobot (free) ──ping /actuator/health mỗi 5 phút──▶ Fly.io
(giữ machine thức từ 6:00–23:00)
```

### Cơ chế hoạt động

| Thời điểm | Trạng thái machine | Hành vi |
|---|---|---|
| Giờ hành chính (6:00–23:00) | **Thức** (UptimeRobot giữ) | Webhook nhận tức thì |
| Ngoài giờ | **Suspend** sau 5 phút idle | Wake up trong 2-5 giây khi có request |
| Admin làm billing | Tự wake up khi truy cập URL | Không cần làm gì thêm |

### Tại sao cold start không phải vấn đề lớn

- **Deduplication** (`existsByBankTransactionId`) đã có sẵn → nếu SePay retry sau khi machine thức, giao dịch không bị ghi đúp
- **ExceptionHandler** luôn trả HTTP 200 → SePay không retry khi nhận được response (chỉ retry nếu timeout/non-200)
- **UptimeRobot** giữ machine thức trong giờ có khả năng chuyển khoản cao nhất

---

## Ước tính chi phí

### Fly.io (`shared-cpu-1x`, 256MB RAM)

```
Đơn giá: $0.00000226/giây khi active

Billing sessions: 3-4 phiên × 2 giờ = ~8 giờ/tháng
  → 8 × 3600 × $0.00000226 ≈ $0.065

Webhook processing: ~100 webhook × 5 giây = ~500 giây
  → $0.001

UptimeRobot ping (17 giờ/ngày × 30 ngày, 5 giây/lần):
  → ~150 phút active ≈ $0.02

Tổng: < $1/tháng
```

### So sánh

| Phương án | Chi phí/tháng | Thay đổi code |
|---|---|---|
| EC2 t3.micro (hiện tại ý định) | ~$8–15 | Không |
| Lightsail $3.5 plan | $3.50 | Không |
| **Fly.io + UptimeRobot** | **< $1** | **Không** |
| AWS Lambda native (GraalVM) | ~$0 | Lớn |

---

## Checklist triển khai (khi sẵn sàng)

### 1. Cài `flyctl`
```bash
# Windows
winget install Flyctl.Flyctl
flyctl auth login
flyctl apps create electricity-billing
```

### 2. Tạo `fly.toml` ở root project

```toml
app = "electricity-billing"
primary_region = "sin"  # Singapore

[build]
  dockerfile = "Dockerfile"

[env]
  SPRING_JPA_HIBERNATE_DDL_AUTO = "update"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "suspend"
  auto_start_machines = true
  min_machines_running = 0

  [http_service.concurrency]
    type = "requests"
    hard_limit = 25
    soft_limit = 20

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"

[[mounts]]
  source = "app_uploads"
  destination = "/app/uploads"
```

### 3. Thêm Spring Actuator vào `pom.xml`

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

Và expose health endpoint trong `application.properties`:
```properties
management.endpoints.web.exposure.include=health
management.endpoint.health.show-details=never
```

### 4. Set secrets trên Fly.io

```bash
fly secrets set \
  DB_HOST="<cloud-db-host>" \
  DB_PORT="3306" \
  DB_NAME="electricity_billing" \
  DB_USERNAME="<user>" \
  DB_PASSWORD="<password>" \
  JWT_SECRET="<secret>" \
  SEPAY_WEBHOOK_SECRET="<sepay-key>" \
  SPRING_PROFILES_ACTIVE="prod" \
  UPLOAD_DIR="/app/uploads" \
  AWS_REGION="<region>" \
  AWS_ACCESS_KEY_ID="<key>" \
  AWS_SECRET_ACCESS_KEY="<secret>" \
  AWS_SNS_SMS_TYPE="Transactional"
```

### 5. Deploy

```bash
flyctl deploy
```

### 6. Cấu hình UptimeRobot

- Đăng ký tại uptimerobot.com (free)
- Add monitor:
  - Type: `HTTP(s)`
  - URL: `https://electricity-billing.fly.dev/actuator/health`
  - Interval: `5 minutes`
- Tạo Maintenance Window: tắt ping ngoài giờ 23:00–06:00

### 7. Cập nhật SePay webhook URL

Đổi URL webhook trong dashboard SePay từ EC2 sang:
```
https://electricity-billing.fly.dev/api/webhooks/sepay
```

---

## Rủi ro & Biện pháp giảm thiểu

| Rủi ro | Khả năng | Biện pháp |
|---|---|---|
| Webhook mất khi machine suspend ngoài 23:00 | Thấp (ít ai chuyển khoản 1–5 sáng) | Chấp nhận; reconcile thủ công nếu cần |
| Cold start > timeout của SePay | Thấp (UptimeRobot giữ thức 6–23h) | Monitor response time sau deploy |
| Fly.io downtime | Rất thấp (99.9% SLA) | Không khác gì VPS thông thường |
| Build Docker thất bại | Thấp | Test `docker build` local trước |

---

## Phương án thay thế (nếu Fly.io không phù hợp)

### AWS App Runner
- Tương tự Fly.io, chạy container, auto-scale
- Nhược điểm: charge minimum ~$3–5/tháng khi paused (không về $0)

### EC2 bật/tắt thủ công
- Admin chạy script start EC2 trước khi làm việc, stop sau
- Webhook: dùng Lambda Node.js nhỏ chỉ nhận payload thô và lưu vào SQS; EC2 xử lý SQS khi khởi động
- Chi phí EC2: chỉ trả cho số giờ chạy (~$0.20/tháng nếu dùng 15–20 giờ)
- Nhược điểm: payments không recorded realtime, cần thêm SQS consumer trong Spring Boot

### GraalVM Native + AWS Lambda
- Compile Spring Boot thành native binary, cold start ~1 giây
- Chi phí: gần như $0
- Nhược điểm: thay đổi build pipeline lớn, một số thư viện JPA/Lombok có thể không tương thích native
