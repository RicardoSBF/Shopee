-- First, handle the duplicate entries in the availability table
DELETE FROM availability a
USING availability b
WHERE a.id > b.id
AND a.user_id = b.user_id
AND a.date = b.date;

-- Drop the existing constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'availability_user_id_date_key'
  ) THEN
    ALTER TABLE availability DROP CONSTRAINT availability_user_id_date_key;
  END IF;
END $$;

-- Add the unique constraint
ALTER TABLE availability ADD CONSTRAINT availability_user_id_date_key UNIQUE (user_id, date);

-- Handle the realtime publication for regions table
-- First check if the table is already in the publication
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'regions'
  ) THEN
    -- Only add to publication if not already there
    ALTER PUBLICATION supabase_realtime ADD TABLE regions;
  END IF;
END $$;

-- Handle the realtime publication for availability table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'availability'
  ) THEN
    -- Only add to publication if not already there
    ALTER PUBLICATION supabase_realtime ADD TABLE availability;
  END IF;
END $$;
