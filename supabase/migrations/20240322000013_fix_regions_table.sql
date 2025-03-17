-- Ensure regions table has proper constraints and indexes
ALTER TABLE IF EXISTS public.regions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add unique constraint to prevent duplicate entries for the same user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'regions_user_id_key'
  ) THEN
    ALTER TABLE public.regions
      ADD CONSTRAINT regions_user_id_key UNIQUE (user_id);
  END IF;
END
$$;

-- Create index for faster queries by primary_region
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'regions_primary_region_idx'
  ) THEN
    CREATE INDEX regions_primary_region_idx ON public.regions (primary_region);
  END IF;
END
$$;

-- Enable realtime for regions table
alter publication supabase_realtime add table regions;
