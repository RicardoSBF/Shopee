-- Add id_number column to users table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id_number') THEN
    ALTER TABLE users ADD COLUMN id_number TEXT;
  END IF;
END $$;

alter publication supabase_realtime add table users;
