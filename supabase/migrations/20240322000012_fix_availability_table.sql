-- Ensure availability table has proper constraints and indexes
ALTER TABLE IF EXISTS public.availability
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add unique constraint to prevent duplicate entries for the same user and date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'availability_user_id_date_key'
  ) THEN
    ALTER TABLE public.availability
      ADD CONSTRAINT availability_user_id_date_key UNIQUE (user_id, date);
  END IF;
END
$$;

-- Create index for faster queries by date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'availability_date_idx'
  ) THEN
    CREATE INDEX availability_date_idx ON public.availability (date);
  END IF;
END
$$;

-- Create index for faster queries by user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'availability_user_id_idx'
  ) THEN
    CREATE INDEX availability_user_id_idx ON public.availability (user_id);
  END IF;
END
$$;

-- Enable realtime for availability table
alter publication supabase_realtime add table availability;
