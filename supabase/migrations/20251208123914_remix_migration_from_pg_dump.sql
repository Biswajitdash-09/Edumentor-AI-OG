CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'student',
    'faculty',
    'admin'
);


--
-- Name: enrollment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enrollment_status AS ENUM (
    'active',
    'completed',
    'dropped'
);


--
-- Name: assign_user_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_user_role(_user_id uuid, _role public.app_role) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only allow if user doesn't already have a role
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role);
  END IF;
END;
$$;


--
-- Name: calculate_distance(numeric, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_distance(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  earth_radius NUMERIC := 6371000; -- Earth's radius in meters
  dlat NUMERIC;
  dlng NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  
  a := sin(dlat/2) * sin(dlat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dlng/2) * sin(dlng/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN earth_radius * c;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email
  );
  RETURN NEW;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


SET default_table_access_method = heap;

--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid,
    faculty_id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    is_pinned boolean DEFAULT false,
    published_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    due_date timestamp with time zone NOT NULL,
    max_points integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'active'::text,
    grace_period_hours integer DEFAULT 0,
    late_penalty_percent numeric DEFAULT 0,
    file_path text,
    file_name text,
    CONSTRAINT assignments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'draft'::text, 'archived'::text])))
);


--
-- Name: attendance_edits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_edits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attendance_record_id uuid NOT NULL,
    edited_by uuid NOT NULL,
    old_status text,
    new_status text NOT NULL,
    reason text,
    edited_at timestamp with time zone DEFAULT now()
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    student_id uuid NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    location_lat numeric(10,7),
    location_lng numeric(10,7),
    status text DEFAULT 'present'::text,
    reason text,
    excuse_type text,
    edited_by uuid,
    edited_at timestamp with time zone,
    CONSTRAINT attendance_records_excuse_type_check CHECK ((excuse_type = ANY (ARRAY['excused'::text, 'unexcused'::text]))),
    CONSTRAINT attendance_records_status_check CHECK ((status = ANY (ARRAY['present'::text, 'late'::text, 'absent'::text])))
);


--
-- Name: attendance_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    faculty_id uuid NOT NULL,
    session_date date NOT NULL,
    session_time time without time zone NOT NULL,
    qr_code text NOT NULL,
    location_lat numeric(10,7),
    location_lng numeric(10,7),
    geofence_radius integer DEFAULT 50,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);


--
-- Name: course_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    file_path text,
    file_type text,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    folder text
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    faculty_id uuid NOT NULL,
    semester text NOT NULL,
    year integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'active'::text,
    CONSTRAINT courses_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);


--
-- Name: discussion_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discussion_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    discussion_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: discussions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discussions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    is_pinned boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    student_id uuid NOT NULL,
    status public.enrollment_status DEFAULT 'active'::public.enrollment_status NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    is_read boolean DEFAULT false,
    link text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    faculty_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    room text,
    start_date date NOT NULL,
    end_date date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: student_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    faculty_id uuid NOT NULL,
    student_id uuid NOT NULL,
    course_id uuid NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    student_id uuid NOT NULL,
    file_path text,
    content text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    grade numeric(5,2),
    feedback text,
    graded_at timestamp with time zone,
    graded_by uuid
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: attendance_edits attendance_edits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_edits
    ADD CONSTRAINT attendance_edits_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_session_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_session_id_student_id_key UNIQUE (session_id, student_id);


--
-- Name: attendance_sessions attendance_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_sessions
    ADD CONSTRAINT attendance_sessions_pkey PRIMARY KEY (id);


--
-- Name: attendance_sessions attendance_sessions_qr_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_sessions
    ADD CONSTRAINT attendance_sessions_qr_code_key UNIQUE (qr_code);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: course_materials course_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_materials
    ADD CONSTRAINT course_materials_pkey PRIMARY KEY (id);


--
-- Name: courses courses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_code_key UNIQUE (code);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: discussion_replies discussion_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_replies
    ADD CONSTRAINT discussion_replies_pkey PRIMARY KEY (id);


--
-- Name: discussions discussions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussions
    ADD CONSTRAINT discussions_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_course_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_course_id_student_id_key UNIQUE (course_id, student_id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: student_notes student_notes_faculty_id_student_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_notes
    ADD CONSTRAINT student_notes_faculty_id_student_id_course_id_key UNIQUE (faculty_id, student_id, course_id);


--
-- Name: student_notes student_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_notes
    ADD CONSTRAINT student_notes_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_assignment_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_assignment_id_student_id_key UNIQUE (assignment_id, student_id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: enrollments unique_student_course; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT unique_student_course UNIQUE (student_id, course_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_assignments_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_course_id ON public.assignments USING btree (course_id);


--
-- Name: idx_assignments_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_due_date ON public.assignments USING btree (due_date);


--
-- Name: idx_attendance_records_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_records_session_id ON public.attendance_records USING btree (session_id);


--
-- Name: idx_attendance_records_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_records_student_id ON public.attendance_records USING btree (student_id);


--
-- Name: idx_attendance_sessions_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_sessions_course_id ON public.attendance_sessions USING btree (course_id);


--
-- Name: idx_attendance_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_sessions_expires_at ON public.attendance_sessions USING btree (expires_at);


--
-- Name: idx_attendance_sessions_qr_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_sessions_qr_code ON public.attendance_sessions USING btree (qr_code);


--
-- Name: idx_chat_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_created_at ON public.chat_messages USING btree (created_at);


--
-- Name: idx_chat_messages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_user_id ON public.chat_messages USING btree (user_id);


--
-- Name: idx_course_materials_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_materials_course_id ON public.course_materials USING btree (course_id);


--
-- Name: idx_course_materials_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_materials_folder ON public.course_materials USING btree (course_id, folder);


--
-- Name: idx_courses_faculty_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_faculty_id ON public.courses USING btree (faculty_id);


--
-- Name: idx_courses_semester_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_semester_year ON public.courses USING btree (semester, year);


--
-- Name: idx_enrollments_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_course_id ON public.enrollments USING btree (course_id);


--
-- Name: idx_enrollments_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_student_id ON public.enrollments USING btree (student_id);


--
-- Name: idx_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);


--
-- Name: idx_submissions_assignment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_assignment_id ON public.submissions USING btree (assignment_id);


--
-- Name: idx_submissions_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_student_id ON public.submissions USING btree (student_id);


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: assignments handle_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: courses handle_courses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: profiles on_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: announcements update_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: discussion_replies update_discussion_replies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_discussion_replies_updated_at BEFORE UPDATE ON public.discussion_replies FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: discussions update_discussions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_discussions_updated_at BEFORE UPDATE ON public.discussions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: schedules update_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: student_notes update_student_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_student_notes_updated_at BEFORE UPDATE ON public.student_notes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: announcements announcements_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: attendance_edits attendance_edits_attendance_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_edits
    ADD CONSTRAINT attendance_edits_attendance_record_id_fkey FOREIGN KEY (attendance_record_id) REFERENCES public.attendance_records(id) ON DELETE CASCADE;


--
-- Name: attendance_edits attendance_edits_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_edits
    ADD CONSTRAINT attendance_edits_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: attendance_records attendance_records_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.profiles(user_id);


--
-- Name: attendance_records attendance_records_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.attendance_sessions(id) ON DELETE CASCADE;


--
-- Name: attendance_records attendance_records_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: attendance_sessions attendance_sessions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_sessions
    ADD CONSTRAINT attendance_sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: attendance_sessions attendance_sessions_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_sessions
    ADD CONSTRAINT attendance_sessions_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: course_materials course_materials_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_materials
    ADD CONSTRAINT course_materials_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_materials course_materials_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_materials
    ADD CONSTRAINT course_materials_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: courses courses_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: discussion_replies discussion_replies_discussion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_replies
    ADD CONSTRAINT discussion_replies_discussion_id_fkey FOREIGN KEY (discussion_id) REFERENCES public.discussions(id) ON DELETE CASCADE;


--
-- Name: discussions discussions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussions
    ADD CONSTRAINT discussions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: student_notes student_notes_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_notes
    ADD CONSTRAINT student_notes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: student_notes student_notes_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_notes
    ADD CONSTRAINT student_notes_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: student_notes student_notes_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_notes
    ADD CONSTRAINT student_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: submissions submissions_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.profiles(user_id);


--
-- Name: submissions submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: schedules Admins can create schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create schedules" ON public.schedules FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: schedules Admins can delete schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete schedules" ON public.schedules FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: schedules Admins can update schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update schedules" ON public.schedules FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: schedules Admins can view all schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all schedules" ON public.schedules FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: courses Anyone can view courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view courses" ON public.courses FOR SELECT TO authenticated USING (true);


--
-- Name: assignments Enrolled students and course faculty can view assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enrolled students and course faculty can view assignments" ON public.assignments FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.enrollments
  WHERE ((enrollments.course_id = assignments.course_id) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::public.enrollment_status)))) OR (EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = assignments.course_id) AND (courses.faculty_id = auth.uid()))))));


--
-- Name: course_materials Enrolled students and faculty can view materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enrolled students and faculty can view materials" ON public.course_materials FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.enrollments
  WHERE ((enrollments.course_id = course_materials.course_id) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::public.enrollment_status)))) OR (EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = course_materials.course_id) AND (courses.faculty_id = auth.uid()))))));


--
-- Name: announcements Faculty can create announcements for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can create announcements for their courses" ON public.announcements FOR INSERT WITH CHECK (((faculty_id = auth.uid()) AND ((course_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = announcements.course_id) AND (courses.faculty_id = auth.uid())))))));


--
-- Name: assignments Faculty can create assignments for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can create assignments for their courses" ON public.assignments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = assignments.course_id) AND (courses.faculty_id = auth.uid())))));


--
-- Name: attendance_sessions Faculty can create attendance sessions for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can create attendance sessions for their courses" ON public.attendance_sessions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = attendance_sessions.course_id) AND (courses.faculty_id = auth.uid())))));


--
-- Name: courses Faculty can create courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can create courses" ON public.courses FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'faculty'::public.app_role) AND (faculty_id = auth.uid())));


--
-- Name: attendance_edits Faculty can create edit records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can create edit records" ON public.attendance_edits FOR INSERT WITH CHECK (((edited_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.attendance_records ar
     JOIN public.attendance_sessions ats ON ((ats.id = ar.session_id)))
  WHERE ((ar.id = attendance_edits.attendance_record_id) AND (ats.faculty_id = auth.uid()))))));


--
-- Name: student_notes Faculty can create notes for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can create notes for their courses" ON public.student_notes FOR INSERT WITH CHECK (((faculty_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = student_notes.course_id) AND (courses.faculty_id = auth.uid()))))));


--
-- Name: schedules Faculty can create schedules for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can create schedules for their courses" ON public.schedules FOR INSERT WITH CHECK (((faculty_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = schedules.course_id) AND (courses.faculty_id = auth.uid()))))));


--
-- Name: assignments Faculty can delete assignments from their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can delete assignments from their courses" ON public.assignments FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = assignments.course_id) AND (courses.faculty_id = auth.uid())))));


--
-- Name: course_materials Faculty can delete materials from their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can delete materials from their courses" ON public.course_materials FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = course_materials.course_id) AND (courses.faculty_id = auth.uid())))));


--
-- Name: attendance_sessions Faculty can delete their attendance sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can delete their attendance sessions" ON public.attendance_sessions FOR DELETE TO authenticated USING ((faculty_id = auth.uid()));


--
-- Name: announcements Faculty can delete their own announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can delete their own announcements" ON public.announcements FOR DELETE USING ((faculty_id = auth.uid()));


--
-- Name: courses Faculty can delete their own courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can delete their own courses" ON public.courses FOR DELETE TO authenticated USING ((faculty_id = auth.uid()));


--
-- Name: student_notes Faculty can delete their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can delete their own notes" ON public.student_notes FOR DELETE USING ((faculty_id = auth.uid()));


--
-- Name: schedules Faculty can delete their own schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can delete their own schedules" ON public.schedules FOR DELETE USING ((faculty_id = auth.uid()));


--
-- Name: submissions Faculty can grade submissions for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can grade submissions for their courses" ON public.submissions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.assignments a
     JOIN public.courses c ON ((c.id = a.course_id)))
  WHERE ((a.id = submissions.assignment_id) AND (c.faculty_id = auth.uid())))));


--
-- Name: assignments Faculty can update assignments for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can update assignments for their courses" ON public.assignments FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = assignments.course_id) AND (courses.faculty_id = auth.uid())))));


--
-- Name: attendance_records Faculty can update attendance records for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can update attendance records for their courses" ON public.attendance_records FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.attendance_sessions s
     JOIN public.courses c ON ((c.id = s.course_id)))
  WHERE ((s.id = attendance_records.session_id) AND (c.faculty_id = auth.uid())))));


--
-- Name: attendance_sessions Faculty can update their attendance sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can update their attendance sessions" ON public.attendance_sessions FOR UPDATE TO authenticated USING ((faculty_id = auth.uid())) WITH CHECK ((faculty_id = auth.uid()));


--
-- Name: announcements Faculty can update their own announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can update their own announcements" ON public.announcements FOR UPDATE USING ((faculty_id = auth.uid()));


--
-- Name: courses Faculty can update their own courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can update their own courses" ON public.courses FOR UPDATE TO authenticated USING ((faculty_id = auth.uid())) WITH CHECK ((faculty_id = auth.uid()));


--
-- Name: student_notes Faculty can update their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can update their own notes" ON public.student_notes FOR UPDATE USING ((faculty_id = auth.uid()));


--
-- Name: schedules Faculty can update their own schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can update their own schedules" ON public.schedules FOR UPDATE USING ((faculty_id = auth.uid()));


--
-- Name: course_materials Faculty can upload materials to their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can upload materials to their courses" ON public.course_materials FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = course_materials.course_id) AND (courses.faculty_id = auth.uid())))) AND (uploaded_by = auth.uid())));


--
-- Name: attendance_records Faculty can view attendance records for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can view attendance records for their courses" ON public.attendance_records FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.attendance_sessions s
     JOIN public.courses c ON ((c.id = s.course_id)))
  WHERE ((s.id = attendance_records.session_id) AND (c.faculty_id = auth.uid())))));


--
-- Name: attendance_edits Faculty can view edits for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can view edits for their courses" ON public.attendance_edits FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.attendance_records ar
     JOIN public.attendance_sessions ats ON ((ats.id = ar.session_id)))
  WHERE ((ar.id = attendance_edits.attendance_record_id) AND (ats.faculty_id = auth.uid())))));


--
-- Name: profiles Faculty can view enrolled student profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can view enrolled student profiles" ON public.profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.enrollments e
     JOIN public.courses c ON ((c.id = e.course_id)))
  WHERE ((e.student_id = profiles.user_id) AND (c.faculty_id = auth.uid()) AND (e.status = 'active'::public.enrollment_status)))));


--
-- Name: attendance_sessions Faculty can view their attendance sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can view their attendance sessions" ON public.attendance_sessions FOR SELECT TO authenticated USING ((faculty_id = auth.uid()));


--
-- Name: announcements Faculty can view their own announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can view their own announcements" ON public.announcements FOR SELECT USING ((faculty_id = auth.uid()));


--
-- Name: student_notes Faculty can view their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can view their own notes" ON public.student_notes FOR SELECT USING ((faculty_id = auth.uid()));


--
-- Name: schedules Faculty can view their own schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Faculty can view their own schedules" ON public.schedules FOR SELECT USING ((faculty_id = auth.uid()));


--
-- Name: submissions Students can create submissions for enrolled courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can create submissions for enrolled courses" ON public.submissions FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM (public.assignments a
     JOIN public.enrollments e ON ((e.course_id = a.course_id)))
  WHERE ((a.id = submissions.assignment_id) AND (e.student_id = auth.uid()) AND (e.status = 'active'::public.enrollment_status)))) AND (student_id = auth.uid())));


--
-- Name: attendance_records Students can create their own attendance records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can create their own attendance records" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (((student_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.attendance_sessions s
     JOIN public.enrollments e ON ((e.course_id = s.course_id)))
  WHERE ((s.id = attendance_records.session_id) AND (e.student_id = auth.uid()) AND (e.status = 'active'::public.enrollment_status) AND (s.expires_at > now()))))));


--
-- Name: enrollments Students can enroll in courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can enroll in courses" ON public.enrollments FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'student'::public.app_role) AND (student_id = auth.uid())));


--
-- Name: enrollments Students can update their own enrollment status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can update their own enrollment status" ON public.enrollments FOR UPDATE TO authenticated USING ((student_id = auth.uid())) WITH CHECK ((student_id = auth.uid()));


--
-- Name: submissions Students can update their own ungraded submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can update their own ungraded submissions" ON public.submissions FOR UPDATE TO authenticated USING (((student_id = auth.uid()) AND (grade IS NULL))) WITH CHECK ((student_id = auth.uid()));


--
-- Name: attendance_sessions Students can view active sessions for enrolled courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view active sessions for enrolled courses" ON public.attendance_sessions FOR SELECT TO authenticated USING (((expires_at > now()) AND (EXISTS ( SELECT 1
   FROM public.enrollments
  WHERE ((enrollments.course_id = attendance_sessions.course_id) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::public.enrollment_status))))));


--
-- Name: announcements Students can view announcements for enrolled courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view announcements for enrolled courses" ON public.announcements FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.enrollments
  WHERE ((enrollments.course_id = announcements.course_id) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::public.enrollment_status)))));


--
-- Name: schedules Students can view schedules for enrolled courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view schedules for enrolled courses" ON public.schedules FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.enrollments
  WHERE ((enrollments.course_id = schedules.course_id) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::public.enrollment_status)))));


--
-- Name: attendance_records Students can view their own attendance records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own attendance records" ON public.attendance_records FOR SELECT TO authenticated USING ((student_id = auth.uid()));


--
-- Name: enrollments Students can view their own enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own enrollments" ON public.enrollments FOR SELECT TO authenticated USING (((student_id = auth.uid()) OR public.has_role(auth.uid(), 'faculty'::public.app_role)));


--
-- Name: submissions Students can view their own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own submissions" ON public.submissions FOR SELECT TO authenticated USING (((student_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.assignments a
     JOIN public.courses c ON ((c.id = a.course_id)))
  WHERE ((a.id = submissions.assignment_id) AND (c.faculty_id = auth.uid()))))));


--
-- Name: notifications System can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: discussions Users can create discussions in their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create discussions in their courses" ON public.discussions FOR INSERT WITH CHECK (((user_id = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM public.enrollments
  WHERE ((enrollments.course_id = discussions.course_id) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::public.enrollment_status)))) OR (EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = discussions.course_id) AND (courses.faculty_id = auth.uid())))))));


--
-- Name: discussion_replies Users can create replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create replies" ON public.discussion_replies FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.discussions d
  WHERE ((d.id = discussion_replies.discussion_id) AND ((EXISTS ( SELECT 1
           FROM public.enrollments
          WHERE ((enrollments.course_id = d.course_id) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::public.enrollment_status)))) OR (EXISTS ( SELECT 1
           FROM public.courses
          WHERE ((courses.id = d.course_id) AND (courses.faculty_id = auth.uid()))))))))));


--
-- Name: chat_messages Users can create their own chat messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own chat messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: discussions Users can delete their own discussions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own discussions" ON public.discussions FOR DELETE USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = discussions.course_id) AND (courses.faculty_id = auth.uid()))))));


--
-- Name: notifications Users can delete their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: discussion_replies Users can delete their own replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own replies" ON public.discussion_replies FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (((auth.uid() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text)));


--
-- Name: discussions Users can update their own discussions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own discussions" ON public.discussions FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: discussion_replies Users can update their own replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own replies" ON public.discussion_replies FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: discussions Users can view discussions for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view discussions for their courses" ON public.discussions FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.enrollments
  WHERE ((enrollments.course_id = discussions.course_id) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::public.enrollment_status)))) OR (EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = discussions.course_id) AND (courses.faculty_id = auth.uid()))))));


--
-- Name: discussion_replies Users can view replies for discussions they can see; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view replies for discussions they can see" ON public.discussion_replies FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.discussions d
  WHERE ((d.id = discussion_replies.discussion_id) AND ((EXISTS ( SELECT 1
           FROM public.enrollments
          WHERE ((enrollments.course_id = d.course_id) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::public.enrollment_status)))) OR (EXISTS ( SELECT 1
           FROM public.courses
          WHERE ((courses.id = d.course_id) AND (courses.faculty_id = auth.uid())))))))));


--
-- Name: chat_messages Users can view their own chat messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own chat messages" ON public.chat_messages FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_edits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_edits ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: course_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

--
-- Name: discussion_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: discussions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: student_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


