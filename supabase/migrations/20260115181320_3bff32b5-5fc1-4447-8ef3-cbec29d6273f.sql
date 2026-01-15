-- Create audit_logs table for tracking sensitive operations
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Authenticated users can insert their own audit logs
CREATE POLICY "Authenticated users can create audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Admins can insert audit logs for any user (for system operations)
CREATE POLICY "Admins can create any audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create trigger function to log role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, metadata)
    VALUES (
      auth.uid(),
      'role_change',
      'user_roles',
      NEW.user_id,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role),
      jsonb_build_object('target_user_id', NEW.user_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for role changes
CREATE TRIGGER trigger_log_role_change
AFTER UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_role_change();

-- Create trigger function to log grade modifications
CREATE OR REPLACE FUNCTION public.log_grade_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.grade IS DISTINCT FROM NEW.grade THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, metadata)
    VALUES (
      auth.uid(),
      'grade_modification',
      'submissions',
      NEW.id,
      jsonb_build_object('grade', OLD.grade, 'feedback', OLD.feedback),
      jsonb_build_object('grade', NEW.grade, 'feedback', NEW.feedback),
      jsonb_build_object('student_id', NEW.student_id, 'assignment_id', NEW.assignment_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for grade modifications
CREATE TRIGGER trigger_log_grade_change
AFTER UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.log_grade_change();

-- Enable realtime for audit logs (admins can monitor in real-time)
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;