-- Phase 1.1: Lock down role self-assignment to student-only
-- This is a critical security fix for production

CREATE OR REPLACE FUNCTION public.assign_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow role assignment if user doesn't have a role yet
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    -- For self-registration, only student role is allowed
    -- Faculty, Admin, and Parent roles must be assigned by an admin
    IF _role = 'student' THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
    ELSE
      RAISE EXCEPTION 'Only student role can be self-assigned. Contact an administrator for other roles.';
    END IF;
  END IF;
END;
$$;