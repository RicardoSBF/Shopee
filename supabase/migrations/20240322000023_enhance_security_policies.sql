-- Enhanced security policies for all tables

-- Strengthen RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
CREATE POLICY "Users can view their own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
CREATE POLICY "Users can update their own data"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
  ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Strengthen RLS on availability table
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own availability" ON public.availability;
CREATE POLICY "Users can view their own availability"
  ON public.availability
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own availability" ON public.availability;
CREATE POLICY "Users can update their own availability"
  ON public.availability
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own availability" ON public.availability;
CREATE POLICY "Users can insert their own availability"
  ON public.availability
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all availability" ON public.availability;
CREATE POLICY "Admins can view all availability"
  ON public.availability
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Strengthen RLS on regions table
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own regions" ON public.regions;
CREATE POLICY "Users can view their own regions"
  ON public.regions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own regions" ON public.regions;
CREATE POLICY "Users can update their own regions"
  ON public.regions
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own regions" ON public.regions;
CREATE POLICY "Users can insert their own regions"
  ON public.regions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all regions" ON public.regions;
CREATE POLICY "Admins can view all regions"
  ON public.regions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Strengthen RLS on routes table
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view routes" ON public.routes;
CREATE POLICY "Everyone can view routes"
  ON public.routes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can insert routes" ON public.routes;
CREATE POLICY "Only admins can insert routes"
  ON public.routes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Only admins can update routes" ON public.routes;
CREATE POLICY "Only admins can update routes"
  ON public.routes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Only admins can delete routes" ON public.routes;
CREATE POLICY "Only admins can delete routes"
  ON public.routes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Strengthen RLS on route_assignments table
ALTER TABLE public.route_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own assignments" ON public.route_assignments;
CREATE POLICY "Users can view their own assignments"
  ON public.route_assignments
  FOR SELECT
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Users can insert their own assignments" ON public.route_assignments;
CREATE POLICY "Users can insert their own assignments"
  ON public.route_assignments
  FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Users can update their own assignments" ON public.route_assignments;
CREATE POLICY "Users can update their own assignments"
  ON public.route_assignments
  FOR UPDATE
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Admins can view all assignments" ON public.route_assignments;
CREATE POLICY "Admins can view all assignments"
  ON public.route_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can update all assignments" ON public.route_assignments;
CREATE POLICY "Admins can update all assignments"
  ON public.route_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Strengthen RLS on email_verifications table
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert email verifications" ON public.email_verifications;
CREATE POLICY "Anyone can insert email verifications"
  ON public.email_verifications
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own email verifications" ON public.email_verifications;
CREATE POLICY "Users can view their own email verifications"
  ON public.email_verifications
  FOR SELECT
  USING (email = auth.email());

-- Create rate limiting function
CREATE OR REPLACE FUNCTION check_rate_limit(p_user_id UUID, p_action TEXT, p_max_requests INT, p_time_window_seconds INT)
RETURNS BOOLEAN AS $$
DECLARE
  request_count INT;
  is_admin BOOLEAN;
BEGIN
  -- Check if user is admin (admins bypass rate limiting)
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND is_admin = true) INTO is_admin;
  IF is_admin THEN
    RETURN TRUE;
  END IF;
  
  -- Count requests in the time window
  SELECT COUNT(*)
  FROM public.security_audit
  WHERE user_id = p_user_id
    AND event_type = p_action
    AND created_at > NOW() - (p_time_window_seconds * INTERVAL '1 second')
  INTO request_count;
  
  -- Return true if under limit, false if over
  RETURN request_count < p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log security events with rate limiting
CREATE OR REPLACE FUNCTION log_security_event_with_rate_limit(
  p_user_id UUID,
  p_event_type TEXT,
  p_details JSONB,
  p_max_requests INT DEFAULT 100,
  p_time_window_seconds INT DEFAULT 60
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Check rate limit
  IF NOT check_rate_limit(p_user_id, p_event_type, p_max_requests, p_time_window_seconds) THEN
    RAISE EXCEPTION 'Rate limit exceeded for action %', p_event_type;
  END IF;
  
  -- Log the event
  INSERT INTO public.security_audit (user_id, event_type, details)
  VALUES (p_user_id, p_event_type, p_details)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add realtime support for security-related tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.route_assignments;
