-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
DROP POLICY IF EXISTS "Users can view their own data" ON users;
CREATE POLICY "Users can view their own data"
    ON users FOR SELECT
    USING (auth.uid() = id OR (SELECT is_admin FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Create policies for regions table
DROP POLICY IF EXISTS "Users can view their own regions" ON regions;
CREATE POLICY "Users can view their own regions"
    ON regions FOR SELECT
    USING (auth.uid() = user_id OR (SELECT is_admin FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own regions" ON regions;
CREATE POLICY "Users can update their own regions"
    ON regions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own regions" ON regions;
CREATE POLICY "Users can insert their own regions"
    ON regions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policies for driver_verification table
DROP POLICY IF EXISTS "Users can view their own verification" ON driver_verification;
CREATE POLICY "Users can view their own verification"
    ON driver_verification FOR SELECT
    USING (auth.uid() = user_id OR (SELECT is_admin FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own verification" ON driver_verification;
CREATE POLICY "Users can update their own verification"
    ON driver_verification FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own verification" ON driver_verification;
CREATE POLICY "Users can insert their own verification"
    ON driver_verification FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policies for availability table
DROP POLICY IF EXISTS "Users can view their own availability" ON availability;
CREATE POLICY "Users can view their own availability"
    ON availability FOR SELECT
    USING (auth.uid() = user_id OR (SELECT is_admin FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own availability" ON availability;
CREATE POLICY "Users can update their own availability"
    ON availability FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own availability" ON availability;
CREATE POLICY "Users can insert their own availability"
    ON availability FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create admin user if it doesn't exist
INSERT INTO users (email, phone_number, password, is_admin, full_name)
VALUES ('admin@shopee.com', 'admin@shopee.com', '123456', true, 'Admin Shopee')
ON CONFLICT (email) DO NOTHING;
