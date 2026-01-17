-- Create assignment-submissions storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assignment-submissions', 'assignment-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for assignment-submissions bucket
-- Students can upload their own submissions
CREATE POLICY "Students can upload assignment submissions"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assignment-submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Students can view their own submissions
CREATE POLICY "Students can view their own submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'assignment-submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Students can update their own submissions
CREATE POLICY "Students can update their own submissions"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'assignment-submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Faculty and admins can view all submissions
CREATE POLICY "Faculty can view all assignment submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'assignment-submissions' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('faculty', 'admin')
  )
);

-- Create student_cgpa table for manual CGPA storage
CREATE TABLE public.student_cgpa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 8),
  cgpa NUMERIC(4,2) CHECK (cgpa >= 0 AND cgpa <= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(student_id, semester)
);

-- Enable RLS on student_cgpa
ALTER TABLE public.student_cgpa ENABLE ROW LEVEL SECURITY;

-- Students can view and manage their own CGPA records
CREATE POLICY "Students can view their own CGPA"
ON public.student_cgpa FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own CGPA"
ON public.student_cgpa FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own CGPA"
ON public.student_cgpa FOR UPDATE
USING (auth.uid() = student_id);

-- Faculty and admins can view all CGPA records
CREATE POLICY "Faculty can view all CGPA"
ON public.student_cgpa FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('faculty', 'admin')
  )
);

-- Create index for performance
CREATE INDEX idx_student_cgpa_student_id ON public.student_cgpa(student_id);

-- Add trigger for updated_at
CREATE TRIGGER update_student_cgpa_updated_at
BEFORE UPDATE ON public.student_cgpa
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Update assign_user_role function to allow all roles for demo/testing
CREATE OR REPLACE FUNCTION public.assign_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow all roles for demo/testing purposes
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role);
  END IF;
END;
$$;