-- Create security audit table to track important security events
CREATE TABLE IF NOT EXISTS public.security_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on the security audit table
ALTER TABLE public.security_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view the security audit logs
DROP POLICY IF EXISTS "Admin can view security audit" ON public.security_audit;
CREATE POLICY "Admin can view security audit"
ON public.security_audit FOR SELECT
USING (auth.uid() IN (SELECT id FROM public.users WHERE is_admin = true));

-- Allow inserting security audit records
DROP POLICY IF EXISTS "Allow inserting security audit records" ON public.security_audit;
CREATE POLICY "Allow inserting security audit records"
ON public.security_audit FOR INSERT
WITH CHECK (true);

-- Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(p_user_id UUID, p_event_type TEXT, p_details JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.security_audit (user_id, event_type, details, ip_address, user_agent)
  VALUES (
    p_user_id,
    p_event_type,
    p_details,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent'
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Create trigger to log password changes
CREATE OR REPLACE FUNCTION public.log_password_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.log_security_event(
    NEW.id,
    'password_changed',
    json_build_object('timestamp', NOW())
  );
  RETURN NEW;
END;
$$;

-- Add trigger to auth.users table for password changes
DROP TRIGGER IF EXISTS log_password_change_trigger ON auth.users;
CREATE TRIGGER log_password_change_trigger
AFTER UPDATE OF encrypted_password ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.log_password_change();
