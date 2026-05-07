# Verify Billing Calculation

Khi được gọi, kiểm tra tính đúng đắn của logic tính tiền trong codebase.

## Công thức chuẩn (Spec V2)

```
unit_price = (evn_total_amount + extra_fee) / total_actual_consumption
             DECIMAL(10,2), RoundingMode.HALF_UP

electricity_amount = unit_price × consumption    [0 decimal, HALF_UP]
service_amount     = service_fee                 [FLAT — không nhân kWh]
total_amount       = electricity_amount + service_amount
```

## Test numbers để xác minh

Dùng bộ số này để verify bất kỳ thay đổi nào liên quan đến calculation:

| Input | Giá trị |
|-------|---------|
| EVN kWh | 2.860 |
| EVN tiền | 4.290.000 đ |
| extraFee | 0 |
| Tổng tiêu thụ thực tế | 2.750 kWh |
| serviceFee | 10.000 đ/hộ |

| Output mong đợi | Giá trị |
|-----------------|---------|
| unit_price | **1.560,00 đ/kWh** (= 4.290.000 / 2.750) |
| Hao hụt | 110 kWh = 3,85% |
| KH001 (300 kWh) | 300 × 1.560 + 10.000 = **478.000 đ** |
| KH007 (280 kWh) | 280 × 1.560 + 10.000 = **446.800 đ** |
| Tổng 10 hộ | 4.290.000 + 100.000 = **4.390.000 đ** |

## Files cần kiểm tra

- `src/main/java/com/loc/electricity/application/service/CalculationEngine.java`
- `src/main/java/com/loc/electricity/application/service/PeriodService.java` (method `calculate()`)
- `frontend/src/pages/PeriodDetailPage.tsx` (unitPrice display: `toLocaleString('vi-VN', { maximumFractionDigits: 2 })`)

## Checklist

- [ ] `service_fee` được dùng FLAT (không nhân consumption)
- [ ] `unitPrice` tính bằng `(evnTotalAmount + extraFee) / totalConsumption`
- [ ] `electricityAmount` làm tròn đến đồng nguyên (scale=0, HALF_UP)
- [ ] `unitPrice` giữ 2 chữ số thập phân (scale=2, HALF_UP)
- [ ] Consumption=0 → total = service_fee → status = PAID (nếu service_fee=0) hoặc PENDING
- [ ] totalConsumption=0 → throw ZERO_CONSUMPTION error
- [ ] Frontend hiển thị unitPrice với 2 decimal (không dùng `formatCurrency` vì VND format làm mất .xx)
