-- Create route_assignments table to track which drivers are assigned to which routes
CREATE TABLE IF NOT EXISTS route_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(route_id, driver_id)
);

-- Add columns to routes table for assignment status
ALTER TABLE routes ADD COLUMN IF NOT EXISTS is_assigned BOOLEAN DEFAULT FALSE;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS assigned_driver TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES users(id);
ALTER TABLE routes ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS is_pending BOOLEAN DEFAULT FALSE;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS pending_since TIMESTAMP WITH TIME ZONE;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- Enable realtime for route_assignments
ALTER PUBLICATION supabase_realtime ADD TABLE route_assignments;
