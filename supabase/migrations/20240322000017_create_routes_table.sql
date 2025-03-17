-- Create routes table if it doesn't exist
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhoods TEXT[] NOT NULL,
  total_distance NUMERIC NOT NULL,
  sequence INTEGER NOT NULL,
  shift TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable row level security
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
DROP POLICY IF EXISTS "Allow all operations on routes" ON routes;
CREATE POLICY "Allow all operations on routes"
  ON routes
  FOR ALL
  USING (true);

-- Enable realtime
-- Publication already exists, no need to add again
-- alter publication supabase_realtime add table routes;