
-- Drop the existing permissive SELECT policy that allows all authenticated users to view all courses
DROP POLICY IF EXISTS "Authenticated users can view courses" ON public.courses;

-- Create policy for students to view all courses (for browsing and enrollment)
CREATE POLICY "Students can view all courses"
ON public.courses
FOR SELECT
USING (has_role(auth.uid(), 'student'::app_role));

-- Create policy for faculty to view ONLY their own courses
CREATE POLICY "Faculty can view their own courses"
ON public.courses
FOR SELECT
USING (faculty_id = auth.uid());

-- Create policy for admins to view all courses
CREATE POLICY "Admins can view all courses"
ON public.courses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create policy for parents to view courses their children are enrolled in
CREATE POLICY "Parents can view enrolled courses"
ON public.courses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM parent_students ps
    JOIN enrollments e ON e.student_id = ps.student_id
    WHERE ps.parent_id = auth.uid()
    AND e.course_id = courses.id
    AND ps.verified = true
  )
);
