-- V5__revert_evn_invoice_tou.sql
-- Remove TOU (Time-of-Use) breakdown columns from evn_invoice.
-- Accountants enter a single kwh + amount per invoice.

ALTER TABLE evn_invoice
    DROP COLUMN normal_kwh,
    DROP COLUMN normal_amount,
    DROP COLUMN peak_kwh,
    DROP COLUMN peak_amount,
    DROP COLUMN off_peak_kwh,
    DROP COLUMN off_peak_amount,
    ADD COLUMN kwh    INT            NOT NULL DEFAULT 0,
    ADD COLUMN amount DECIMAL(15, 2) NOT NULL DEFAULT 0;
