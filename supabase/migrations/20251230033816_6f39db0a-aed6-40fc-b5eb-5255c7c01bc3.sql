-- Update assign_user_role function to only allow 'student' role for self-registration
-- This prevents privilege escalation where users could register as admin/faculty
CREATE OR REPLACE FUNCTION public.assign_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For self-registration, only allow 'student' role
  -- Admins can still assign other roles via the admin dashboard using direct INSERT
  IF _role != 'student' THEN
    RAISE EXCEPTION 'Self-registration is only allowed for student role. Contact an administrator for other roles.';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role);
  END IF;
END;
$$;

-- Strengthen RLS policies with explicit auth checks

-- 1. Update notifications INSERT policy to require authentication
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Strengthen profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 3. Strengthen user_roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 4. Strengthen chat_messages policies
DROP POLICY IF EXISTS "Users can view their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view their own chat messages" 
ON public.chat_messages 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can create their own chat messages" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- 5. Strengthen notification_preferences policies
DROP POLICY IF EXISTS "Users can view own preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own preferences" 
ON public.notification_preferences 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own preferences" 
ON public.notification_preferences 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own preferences" 
ON public.notification_preferences 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 6. Strengthen enrollments policies
DROP POLICY IF EXISTS "Students can enroll in courses" ON public.enrollments;
CREATE POLICY "Students can enroll in courses" 
ON public.enrollments 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'student') AND student_id = auth.uid());

DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.enrollments;
CREATE POLICY "Students can view their own enrollments" 
ON public.enrollments 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND (student_id = auth.uid() OR has_role(auth.uid(), 'faculty')));

DROP POLICY IF EXISTS "Students can update their own enrollment status" ON public.enrollments;
CREATE POLICY "Students can update their own enrollment status" 
ON public.enrollments 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND student_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND student_id = auth.uid());