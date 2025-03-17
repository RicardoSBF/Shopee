-- Add email column to users table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') THEN
    ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
    
    -- Update existing records to set email equal to phone_number
    UPDATE users SET email = phone_number WHERE email IS NULL;
  END IF;
END $$;

-- Make email column NOT NULL
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Add index on email column for faster lookups
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

alter publication supabase_realtime add table users;
