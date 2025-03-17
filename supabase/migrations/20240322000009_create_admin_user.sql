-- Check if admin user already exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'admincb@shopee.com') THEN
        -- Insert admin user
        INSERT INTO public.users (email, phone_number, password, is_admin, full_name, id_number)
        VALUES ('admincb@shopee.com', 'admincb@shopee.com', '123456', true, 'Admin Shopee', 'ADMIN001');
    END IF;
END
$$;