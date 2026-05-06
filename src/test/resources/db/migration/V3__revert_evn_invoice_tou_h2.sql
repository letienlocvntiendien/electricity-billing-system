-- V3__revert_evn_invoice_tou_h2.sql
-- H2-compatible version of V5__revert_evn_invoice_tou.sql

ALTER TABLE evn_invoice DROP COLUMN normal_kwh;
ALTER TABLE evn_invoice DROP COLUMN normal_amount;
ALTER TABLE evn_invoice DROP COLUMN peak_kwh;
ALTER TABLE evn_invoice DROP COLUMN peak_amount;
ALTER TABLE evn_invoice DROP COLUMN off_peak_kwh;
ALTER TABLE evn_invoice DROP COLUMN off_peak_amount;
ALTER TABLE evn_invoice ADD COLUMN kwh    INT            NOT NULL DEFAULT 0;
ALTER TABLE evn_invoice ADD COLUMN amount DECIMAL(15, 2) NOT NULL DEFAULT 0;
