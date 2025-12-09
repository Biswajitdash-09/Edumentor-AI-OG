-- Add 'parent' role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';

-- Create parent-student linking table
CREATE TABLE public.parent_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL,
  student_id UUID NOT NULL,
  relationship TEXT DEFAULT 'parent',
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_id, student_id)
);

ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

-- Create meeting links table for courses
CREATE TABLE public.course_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_url TEXT NOT NULL,
  meeting_type TEXT DEFAULT 'zoom',
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 60,
  description TEXT,
  is_recurring BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_meetings ENABLE ROW LEVEL SECURITY;

-- Create parent messages table for communication
CREATE TABLE public.parent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL,
  faculty_id UUID NOT NULL,
  student_id UUID NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('parent', 'faculty')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_messages ENABLE ROW LEVEL SECURITY;

-- Create plagiarism reports table
CREATE TABLE public.plagiarism_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  similarity_score NUMERIC NOT NULL DEFAULT 0,
  similar_submissions JSONB DEFAULT '[]',
  ai_analysis TEXT,
  status TEXT DEFAULT 'pending',
  checked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id)
);

ALTER TABLE public.plagiarism_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parent_students
CREATE POLICY "Parents can view their linked students"
  ON public.parent_students FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can request to link students"
  ON public.parent_students FOR INSERT
  WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Admins can manage parent-student links"
  ON public.parent_students FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for course_meetings
CREATE POLICY "Faculty can manage their course meetings"
  ON public.course_meetings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM courses WHERE id = course_meetings.course_id AND faculty_id = auth.uid()
  ));

CREATE POLICY "Students can view meetings for enrolled courses"
  ON public.course_meetings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM enrollments 
    WHERE course_id = course_meetings.course_id 
    AND student_id = auth.uid() 
    AND status = 'active'
  ));

CREATE POLICY "Parents can view meetings for their children courses"
  ON public.course_meetings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM parent_students ps
    JOIN enrollments e ON e.student_id = ps.student_id
    WHERE ps.parent_id = auth.uid() 
    AND e.course_id = course_meetings.course_id
    AND ps.verified = true
  ));

-- RLS Policies for parent_messages
CREATE POLICY "Parents can view their messages"
  ON public.parent_messages FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can send messages"
  ON public.parent_messages FOR INSERT
  WITH CHECK (parent_id = auth.uid() AND sender_type = 'parent');

CREATE POLICY "Faculty can view messages about their students"
  ON public.parent_messages FOR SELECT
  USING (faculty_id = auth.uid());

CREATE POLICY "Faculty can send messages to parents"
  ON public.parent_messages FOR INSERT
  WITH CHECK (faculty_id = auth.uid() AND sender_type = 'faculty');

CREATE POLICY "Recipients can mark messages as read"
  ON public.parent_messages FOR UPDATE
  USING (
    (sender_type = 'parent' AND faculty_id = auth.uid()) OR
    (sender_type = 'faculty' AND parent_id = auth.uid())
  );

-- RLS Policies for plagiarism_reports
CREATE POLICY "Faculty can view plagiarism reports for their courses"
  ON public.plagiarism_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = a.course_id
    WHERE s.id = plagiarism_reports.submission_id AND c.faculty_id = auth.uid()
  ));

CREATE POLICY "Faculty can create plagiarism reports"
  ON public.plagiarism_reports FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = a.course_id
    WHERE s.id = plagiarism_reports.submission_id AND c.faculty_id = auth.uid()
  ));

CREATE POLICY "Faculty can update plagiarism reports"
  ON public.plagiarism_reports FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = a.course_id
    WHERE s.id = plagiarism_reports.submission_id AND c.faculty_id = auth.uid()
  ));

-- Update assign_user_role to include parent role
CREATE OR REPLACE FUNCTION public.assign_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role);
  END IF;
END;
$$;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_meetings;