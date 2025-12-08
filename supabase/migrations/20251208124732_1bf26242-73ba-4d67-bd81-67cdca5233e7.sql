-- Fix 1: Modify assign_user_role to only allow 'student' role for self-registration
CREATE OR REPLACE FUNCTION public.assign_user_role(_user_id uuid, _role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow if user doesn't already have a role
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    -- SECURITY: Only allow 'student' role for self-registration
    -- Faculty and admin roles must be assigned by an admin
    IF _role = 'student' THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (_user_id, _role);
    ELSE
      RAISE EXCEPTION 'Only student role can be self-assigned. Contact an administrator for elevated roles.';
    END IF;
  END IF;
END;
$function$;

-- Fix 2: Update courses RLS policy to require authentication
DROP POLICY IF EXISTS "Anyone can view courses" ON public.courses;
CREATE POLICY "Authenticated users can view courses" 
ON public.courses 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Fix 3: Remove open INSERT policy on notifications and replace with service-role only
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
-- Note: Notifications will now only be insertable via service_role (edge functions)