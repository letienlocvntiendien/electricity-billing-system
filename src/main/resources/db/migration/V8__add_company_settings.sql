-- Add company identity settings used in bill PDF header
INSERT INTO system_setting (setting_key, setting_value, description) VALUES
    ('company_name',    'Ban Quản Lý Khu Phố',  'Tên ban quản lý hiển thị trên hóa đơn PDF'),
    ('company_address', '',                       'Địa chỉ / số điện thoại liên hệ trên hóa đơn PDF');
