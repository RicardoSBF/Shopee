-- Enable RLS on all tables
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for regions table
DROP POLICY IF EXISTS "Users can view all regions" ON public.regions;
CREATE POLICY "Users can view all regions"
ON public.regions FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admin can manage regions" ON public.regions;
CREATE POLICY "Admin can manage regions"
ON public.regions FOR ALL
USING (auth.uid() IN (SELECT id FROM public.users WHERE is_admin = true));

-- Create policies for availability table
DROP POLICY IF EXISTS "Users can view their own availability" ON public.availability;
CREATE POLICY "Users can view their own availability"
ON public.availability FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own availability" ON public.availability;
CREATE POLICY "Users can manage their own availability"
ON public.availability FOR INSERT UPDATE DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can view all availability" ON public.availability;
CREATE POLICY "Admin can view all availability"
ON public.availability FOR SELECT
USING (auth.uid() IN (SELECT id FROM public.users WHERE is_admin = true));

-- Create policies for driver_verification table
DROP POLICY IF EXISTS "Users can view their own verification" ON public.driver_verification;
CREATE POLICY "Users can view their own verification"
ON public.driver_verification FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own verification" ON public.driver_verification;
CREATE POLICY "Users can manage their own verification"
ON public.driver_verification FOR INSERT UPDATE DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can view all verifications" ON public.driver_verification;
CREATE POLICY "Admin can view all verifications"
ON public.driver_verification FOR SELECT
USING (auth.uid() IN (SELECT id FROM public.users WHERE is_admin = true));

-- Create policies for users table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admin can view all users" ON public.users;
CREATE POLICY "Admin can view all users"
ON public.users FOR SELECT
USING (auth.uid() IN (SELECT id FROM public.users WHERE is_admin = true));

DROP POLICY IF EXISTS "Admin can manage all users" ON public.users;
CREATE POLICY "Admin can manage all users"
ON public.users FOR ALL
USING (auth.uid() IN (SELECT id FROM public.users WHERE is_admin = true));

-- Create policies for routes table
DROP POLICY IF EXISTS "Users can view available routes" ON public.routes;
CREATE POLICY "Users can view available routes"
ON public.routes FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admin can manage routes" ON public.routes;
CREATE POLICY "Admin can manage routes"
ON public.routes FOR ALL
USING (auth.uid() IN (SELECT id FROM public.users WHERE is_admin = true));

-- Create policies for route_assignments table
DROP POLICY IF EXISTS "Users can view their own assignments" ON public.route_assignments;
CREATE POLICY "Users can view their own assignments"
ON public.route_assignments FOR SELECT
USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Users can request routes" ON public.route_assignments;
CREATE POLICY "Users can request routes"
ON public.route_assignments FOR INSERT
WITH CHECK (auth.uid() = driver_id AND status = 'pending');

DROP POLICY IF EXISTS "Users can update their own assignments" ON public.route_assignments;
CREATE POLICY "Users can update their own assignments"
ON public.route_assignments FOR UPDATE
USING (auth.uid() = driver_id AND status IN ('pending', 'rejected'));

DROP POLICY IF EXISTS "Admin can manage all assignments" ON public.route_assignments;
CREATE POLICY "Admin can manage all assignments"
ON public.route_assignments FOR ALL
USING (auth.uid() IN (SELECT id FROM public.users WHERE is_admin = true));

-- Enable realtime for route_assignments to support notifications
alter publication supabase_realtime add table public.route_assignments;
