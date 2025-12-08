-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create course-materials storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-materials', 'course-materials', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for course-materials bucket

-- Allow authenticated users to view files from courses they're enrolled in or teaching
CREATE POLICY "Users can view course materials"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-materials' AND
  (
    -- Faculty can view materials for their courses
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id::text = (storage.foldername(name))[1]
      AND c.faculty_id = auth.uid()
    )
    OR
    -- Students can view materials for courses they're enrolled in
    EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.courses c ON c.id = e.course_id
      WHERE c.id::text = (storage.foldername(name))[1]
      AND e.student_id = auth.uid()
      AND e.status = 'active'
    )
    OR
    -- Admins can view all materials
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  )
);

-- Allow faculty to upload materials to their courses
CREATE POLICY "Faculty can upload course materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND c.faculty_id = auth.uid()
  )
);

-- Allow faculty to update their course materials
CREATE POLICY "Faculty can update course materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND c.faculty_id = auth.uid()
  )
);

-- Allow faculty to delete their course materials
CREATE POLICY "Faculty can delete course materials"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND c.faculty_id = auth.uid()
  )
);

-- Create notification_preferences table for email settings
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email_announcements BOOLEAN NOT NULL DEFAULT true,
  email_assignments BOOLEAN NOT NULL DEFAULT true,
  email_grades BOOLEAN NOT NULL DEFAULT true,
  email_attendance BOOLEAN NOT NULL DEFAULT true,
  email_digest BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own preferences"
ON public.notification_preferences FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
ON public.notification_preferences FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
ON public.notification_preferences FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create trigger for updating updated_at on notification_preferences
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();