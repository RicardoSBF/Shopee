-- Ensure email column exists in users table
ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS email TEXT;

-- Update any existing records that might have null email
UPDATE public.users
SET email = phone_number
WHERE email IS NULL AND phone_number IS NOT NULL;

-- Add unique constraint to email column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_key' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
EXCEPT
  WHEN others THEN
    -- Constraint might already exist
    NULL;
END $$;

-- Create admin user if it doesn't exist
INSERT INTO public.users (email, phone_number, password, is_admin, full_name, id_number)
VALUES ('admincb@shopee.com', 'admincb@shopee.com', '123456', true, 'Admin User', 'ADMIN001')
ON CONFLICT (email) DO NOTHING;

-- Enable realtime for users table
alter publication supabase_realtime add table users;
