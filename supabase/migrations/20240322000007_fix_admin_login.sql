-- Fix admin login issues
UPDATE users SET is_admin = true WHERE email = 'admin@shopee.com';

-- Ensure all users have email field populated
UPDATE users SET email = phone_number WHERE email IS NULL;

-- Add index on email for faster lookups
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
