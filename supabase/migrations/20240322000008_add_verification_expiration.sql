-- Add expiration date to driver verification
ALTER TABLE driver_verification ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMP WITH TIME ZONE;

-- Update existing records to have an expiration date 3 days from now
UPDATE driver_verification 
SET expiration_date = NOW() + INTERVAL '3 days' 
WHERE expiration_date IS NULL;
