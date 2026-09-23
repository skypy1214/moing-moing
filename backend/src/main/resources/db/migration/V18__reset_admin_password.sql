update user_accounts
set password_hash = '$2a$10$uPHmGy/ZNbxtFs3wwcfseeroLZD3RmWszchKuIhvYmCBvYm3i0tli',
    updated_at = now()
where login_id = 'admin';
