-- Enable realtime for other key tables (notifications already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;

-- Allow triggers to insert notifications
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create function to notify enrolled students about new assignments
CREATE OR REPLACE FUNCTION public.notify_new_assignment()
RETURNS TRIGGER AS $$
DECLARE
  student_record RECORD;
  course_title TEXT;
BEGIN
  SELECT title INTO course_title FROM public.courses WHERE id = NEW.course_id;
  
  FOR student_record IN 
    SELECT student_id FROM public.enrollments 
    WHERE course_id = NEW.course_id AND status = 'active'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      student_record.student_id,
      'New Assignment Posted',
      'New assignment "' || NEW.title || '" in ' || course_title || ' is due ' || to_char(NEW.due_date, 'Mon DD, YYYY'),
      'info',
      '/courses/' || NEW.course_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_assignment_created ON public.assignments;
CREATE TRIGGER on_assignment_created
  AFTER INSERT ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_assignment();

-- Create function to notify student when their submission is graded
CREATE OR REPLACE FUNCTION public.notify_submission_graded()
RETURNS TRIGGER AS $$
DECLARE
  assignment_title TEXT;
  course_title TEXT;
BEGIN
  IF OLD.grade IS NULL AND NEW.grade IS NOT NULL THEN
    SELECT a.title, c.title 
    INTO assignment_title, course_title
    FROM public.assignments a
    JOIN public.courses c ON c.id = a.course_id
    WHERE a.id = NEW.assignment_id;
    
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.student_id,
      'Assignment Graded',
      'Your submission for "' || assignment_title || '" in ' || course_title || ' has been graded: ' || NEW.grade || ' points',
      'success',
      '/grades'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_submission_graded ON public.submissions;
CREATE TRIGGER on_submission_graded
  AFTER UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_submission_graded();

-- Create function to notify students about new attendance sessions
CREATE OR REPLACE FUNCTION public.notify_attendance_session()
RETURNS TRIGGER AS $$
DECLARE
  student_record RECORD;
  course_title TEXT;
BEGIN
  SELECT title INTO course_title FROM public.courses WHERE id = NEW.course_id;
  
  FOR student_record IN 
    SELECT student_id FROM public.enrollments 
    WHERE course_id = NEW.course_id AND status = 'active'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      student_record.student_id,
      'Attendance Session Active',
      'Attendance is now open for ' || course_title || '. Expires at ' || to_char(NEW.expires_at, 'HH:MI AM'),
      'warning',
      '/attendance'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_attendance_session_created ON public.attendance_sessions;
CREATE TRIGGER on_attendance_session_created
  AFTER INSERT ON public.attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_attendance_session();

-- Create function to notify students about new announcements
CREATE OR REPLACE FUNCTION public.notify_new_announcement()
RETURNS TRIGGER AS $$
DECLARE
  student_record RECORD;
  course_title TEXT;
BEGIN
  IF NEW.course_id IS NOT NULL THEN
    SELECT title INTO course_title FROM public.courses WHERE id = NEW.course_id;
    
    FOR student_record IN 
      SELECT student_id FROM public.enrollments 
      WHERE course_id = NEW.course_id AND status = 'active'
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        student_record.student_id,
        'New Announcement',
        course_title || ': ' || NEW.title,
        'info',
        '/announcements'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_announcement_created ON public.announcements;
CREATE TRIGGER on_announcement_created
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_announcement();