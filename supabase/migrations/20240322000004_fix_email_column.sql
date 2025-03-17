-- Add email column to users table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') THEN
    ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
    
    -- Update existing users to have email same as phone_number for backward compatibility
    UPDATE users SET email = phone_number WHERE email IS NULL;
  END IF;
END $$;

-- Make sure admin user exists with proper email
INSERT INTO users (email, phone_number, password, is_admin, full_name)
VALUES ('admin@shopee.com', 'admin@shopee.com', '123456', true, 'Administrator')
ON CONFLICT (email) DO NOTHING;
