-- Migration to seed application profile and user role for the super_admin account
-- Assumes school ID '11111111-1111-1111-1111-111111111111' exists (Oakridge International School from seed data)

DO $$
DECLARE
  v_school_id uuid := '11111111-1111-1111-1111-111111111111';
  v_user_record RECORD;
BEGIN
  -- 1. Super Admin profile & role mapping
  FOR v_user_record IN SELECT id FROM auth.users WHERE email = 'admin@school.edu' LOOP
    INSERT INTO public.profiles (id, school_id, first_name, last_name, phone, first_login)
    VALUES (v_user_record.id, v_school_id, 'Super', 'Admin', '555-0101', false)
    ON CONFLICT (id) DO UPDATE SET first_login = EXCLUDED.first_login;

    INSERT INTO public.user_roles (school_id, profile_id, role)
    VALUES (v_school_id, v_user_record.id, 'super_admin')
    ON CONFLICT (school_id, profile_id, role) DO NOTHING;
  END LOOP;

END $$;
