
# 5-Phase Enhancement Plan for Production Readiness

## Phase 1: Security Hardening & Critical Fixes
**Priority: CRITICAL | Effort: Low | Impact: High**

### 1.1 Lock Down Role Self-Assignment
- Create new migration to update `assign_user_role` function
- Only allow `student` role for self-registration
- Remove role selector from signup form in `Auth.tsx`
- Keep admin-only role management via dashboard

### 1.2 Enable Leaked Password Protection
- Configure Supabase auth to enable HaveIBeenPwned integration
- Add password strength indicator to signup form

### 1.3 Replace Hardcoded Stats with Real Data
- Update `Index.tsx` to fetch actual counts from database
- Create public statistics edge function for landing page
- Show real student count, faculty count, course count

### 1.4 Fix Demo Video Dialog
- Either remove "Watch Demo" button entirely
- Or create a proper walkthrough video/slideshow component

---

## Phase 2: Error Handling & User Feedback
**Priority: HIGH | Effort: Medium | Impact: High**

### 2.1 Add User Feedback for Silent Failures
Files to update with toast notifications:
- `src/hooks/useAuditLog.ts` - Add toast on audit log failure
- `src/components/QuickSearch.tsx` - Add "Search failed" toast
- `src/components/BulkGradingDialog.tsx:142` - Add warning toast for notification failure
- `src/components/CreateAnnouncementDialog.tsx:109` - Add warning toast
- `src/pages/Attendance.tsx:197` - Add warning toast
- `src/pages/CourseDetails.tsx:281` - Add warning toast
- `src/pages/GradeSubmissions.tsx:142` - Add warning toast

### 2.2 Improve Email Notification Reliability
- Add retry logic to email edge functions
- Create notification fallback to in-app if email fails
- Show user when email couldn't be sent

### 2.3 Enhanced Loading States
- Add skeleton loaders to remaining pages without them
- Improve error boundary with more helpful messages

---

## Phase 3: Complete Missing Workflows
**Priority: HIGH | Effort: Medium | Impact: High**

### 3.1 Faculty Messaging Portal
- Add "Parent Messages" tab to Faculty Dashboard
- Create `FacultyMessagesTab.tsx` component
- Allow faculty to view and reply to parent messages
- Add real-time notifications for new messages

### 3.2 Google Calendar Full Sync
Update `CalendarSync.tsx`:
- Generate proper Google Calendar URLs with all schedule data
- Loop through all schedules, not just first one
- Add date/time parameters to events
- Support batch event creation

### 3.3 Discussion Forum Integration
- Create `DiscussionForum.tsx` component (tables already exist)
- Add Discussions tab to `CourseDetails.tsx`
- Allow students/faculty to post and reply
- Add moderation tools for faculty

### 3.4 Meeting Integration
- Add `CourseMeetings` component to `CourseDetails.tsx`
- Allow faculty to schedule online meetings
- Add Zoom/Google Meet link support

---

## Phase 4: Admin System Health & Monitoring
**Priority: MEDIUM | Effort: Medium | Impact: Medium**

### 4.1 System Health Dashboard Card
Create `SystemHealthCard.tsx` with:
- Storage bucket usage (course-materials, assignment-submissions, avatars)
- Active user sessions count
- Database table row counts
- Edge function invocation stats (if available)

### 4.2 Scheduled Assignment Reminders
- Create Supabase cron job to run `assignment-reminders` daily
- Add admin toggle to enable/disable reminders
- Show reminder history in admin dashboard

### 4.3 Email Digest Implementation
- Create `send-daily-digest` edge function
- Aggregate notifications from past 24 hours
- Send single email with summary
- Add scheduling configuration

### 4.4 Enhanced Audit Log Dashboard
- Add date range picker filter
- Add user-specific log view
- Add export to CSV/PDF functionality
- Add action type filtering

---

## Phase 5: Performance & Polish
**Priority: MEDIUM | Effort: High | Impact: High**

### 5.1 Code Splitting & Lazy Loading
- Implement `React.lazy()` for all route components
- Add Suspense boundaries with loading fallbacks
- Reduce initial bundle size

### 5.2 Query Optimization
- Add proper pagination to all list views (currently limited to 1000 rows)
- Implement virtual scrolling for long lists
- Add database indexes for frequently queried fields

### 5.3 Accessibility Improvements
- Add ARIA labels to all interactive elements
- Improve keyboard navigation
- Add skip-to-content links
- Test with screen readers

### 5.4 Real-time Subscriptions
- Add Supabase Realtime for:
  - Notifications (instant alerts)
  - Chat messages in AI Mentor
  - Parent-faculty messages
  - Attendance session status

### 5.5 Documentation & Onboarding
- Create in-app tour for first-time users
- Add contextual help tooltips
- Create admin user guide

---

## Files to Modify Summary

| Phase | Files Count | Key Files |
|-------|-------------|-----------|
| 1 | 4 | Auth.tsx, Index.tsx, migration, DemoVideoDialog.tsx |
| 2 | 8 | Multiple error handling fixes |
| 3 | 6 | CalendarSync.tsx, CourseDetails.tsx, new components |
| 4 | 5 | AdminDashboard.tsx, new edge functions, AuditLogViewer.tsx |
| 5 | 15+ | App.tsx, all major pages, accessibility updates |

---

## Database Changes Required

### Phase 1:
```sql
-- Lock down role assignment
CREATE OR REPLACE FUNCTION public.assign_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    IF _role = 'student' THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
    ELSE
      RAISE EXCEPTION 'Only student role can be self-assigned';
    END IF;
  END IF;
END;
$$;
```

### Phase 4:
- Create `scheduled_tasks` table for cron job tracking
- Add `last_digest_sent` column to `notification_preferences`

---

## Edge Functions to Create/Update

| Function | Phase | Purpose |
|----------|-------|---------|
| `get-public-stats` | 1 | Fetch real counts for landing page |
| `send-daily-digest` | 4 | Compile and send notification digest |
| `assignment-reminders` | 4 | Schedule via cron (already exists) |

---

## Success Metrics

After implementing all phases:
- Zero security warnings in linter
- 100% of user actions provide feedback (no silent failures)
- All workflows complete end-to-end
- Admin has full visibility into system health
- Lighthouse accessibility score > 90
