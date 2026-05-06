-- ============================================================
-- clear_billing_data.sql
-- Xóa toàn bộ dữ liệu billing để test lại từ đầu.
-- Giữ nguyên: user, customer, system_setting
-- ============================================================
-- Cách chạy:
--   MySQL Workbench: File > Open SQL Script > chọn file này > Execute
--   CLI:  mysql -u root -p electricity_billing < sql/clear_billing_data.sql
-- ============================================================

USE electricity_billing;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE payment;
TRUNCATE TABLE bill;
TRUNCATE TABLE meter_reading;
TRUNCATE TABLE evn_invoice;
TRUNCATE TABLE billing_period;
TRUNCATE TABLE audit_log;
TRUNCATE TABLE refresh_token;

SET FOREIGN_KEY_CHECKS = 1;

-- Xác nhận kết quả
SELECT 'billing_period' AS tbl, COUNT(*) AS rows_remaining FROM billing_period
UNION ALL SELECT 'meter_reading',  COUNT(*) FROM meter_reading
UNION ALL SELECT 'evn_invoice',    COUNT(*) FROM evn_invoice
UNION ALL SELECT 'bill',           COUNT(*) FROM bill
UNION ALL SELECT 'payment',        COUNT(*) FROM payment
UNION ALL SELECT 'audit_log',      COUNT(*) FROM audit_log
UNION ALL SELECT 'refresh_token',  COUNT(*) FROM refresh_token
UNION ALL SELECT 'user (kept)',     COUNT(*) FROM user
UNION ALL SELECT 'customer (kept)', COUNT(*) FROM customer;

-- ============================================================
-- RESET HOÀN TOÀN (bao gồm user + customer):
-- Bỏ comment các dòng dưới, sau đó restart app với dev profile
-- DataInitializer sẽ tự động re-seed toàn bộ dữ liệu.
-- ============================================================
-- TRUNCATE TABLE customer;
-- TRUNCATE TABLE user;
