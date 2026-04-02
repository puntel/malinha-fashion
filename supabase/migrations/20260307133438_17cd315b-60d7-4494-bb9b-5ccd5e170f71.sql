-- HOTFIX: reset temporary master password for urgent access validation
UPDATE auth.users
SET encrypted_password = crypt('A1b2c3', gen_salt('bf')),
    updated_at = now()
WHERE email = 'joaopuntel@gmail.com';