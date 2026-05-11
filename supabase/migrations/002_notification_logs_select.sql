-- ============================================================
-- 002 — Allow authenticated users to read their own notification logs
-- ============================================================
-- The initial migration only granted access to service_role, which meant
-- the foreground app silently received an empty array when fetching the
-- "last ping" metadata for friend cards. This policy lets the app read
-- the rows it needs while still blocking writes (service_role only).
-- ============================================================

create policy "notification_logs_select_own"
  on public.notification_logs
  for select
  using (auth.uid() = user_id);
