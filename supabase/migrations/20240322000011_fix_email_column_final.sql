-- Add email column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'users' 
               AND column_name = 'email') THEN
    ALTER TABLE public.users ADD COLUMN email TEXT;
  END IF;

  -- Update email column with phone_number values where email is null
  UPDATE public.users SET email = phone_number WHERE email IS NULL;

  -- Ensure admin user exists
  INSERT INTO public.users (phone_number, password, is_admin, full_name, id_number, email)
  VALUES ('admincb@shopee.com', '123456', true, 'Admin User', 'ADMIN001', 'admincb@shopee.com')
  ON CONFLICT (phone_number) DO UPDATE 
  SET is_admin = true, 
      password = '123456',
      email = 'admincb@shopee.com';

END $$;
