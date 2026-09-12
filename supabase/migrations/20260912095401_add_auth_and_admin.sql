/*
# Add authentication support: user_id on complaints + admin profiles

## Overview
This migration adds optional user authentication to the Prishtina Raporton platform.
Citizens can report complaints without logging in (anonymous reporting stays).
When logged in, complaints are linked to their account so they have a saved history.
Admin staff get a separate login to access the admin panel for status management.

## 1. Schema Changes

### complaints table — add user_id column
- `user_id` (uuid, nullable) — links a complaint to an authenticated user.
  Nullable so anonymous reports (no login) still work.
  When a logged-in user reports, this is set to their auth.uid().
  No foreign key constraint to avoid breaking anonymous inserts.

### admin_users table (new)
- `id` (uuid, primary key) — matches auth.users.id
- `email` (text, not null) — admin email
- `display_name` (text) — admin display name
- `created_at` (timestamptz) — when admin was added
- This table tracks which authenticated users are admins.
  RLS allows only admins to read the table (to check admin status).
  Insert is done via SQL (service role) — no public insert policy.

## 2. Security Changes

### complaints table policies
- SELECT stays public (anon + authenticated) — all complaints are visible on the map.
- INSERT stays public (anon + authenticated) — anyone can report.
- UPDATE: restricted to authenticated users only (admin status changes).
  Anonymous users can no longer update complaints.
  The confirm-resolved feature requires login.
- DELETE: restricted to authenticated users only.

### admin_users table
- RLS enabled.
- SELECT: only authenticated users who are themselves in admin_users can read.
  This lets the app check if the current user is an admin.
- No INSERT/UPDATE/DELETE policies — admin management is done server-side.

## 3. Important Notes
1. The complaints table already has reporter_token for anonymous ownership.
   Logged-in users get user_id set in addition, so their history persists across devices.
2. Anonymous reporters still use the localStorage token system for confirm-resolved.
3. Admin status changes require authenticated access via UPDATE policy.
4. The admin_users table must be populated via SQL (service role) to grant admin access.
*/ 

-- Add user_id column to complaints (nullable for anonymous reports)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complaints' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE complaints ADD COLUMN user_id uuid;
  END IF;
END $$;

-- Drop old open UPDATE policy (was anon + authenticated)
DROP POLICY IF EXISTS "anon_update_complaints" ON complaints;

-- New UPDATE policy: only authenticated users can update (admin status changes + confirm-resolved)
CREATE POLICY "authenticated_update_complaints" ON complaints FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

-- Drop old open DELETE policy
DROP POLICY IF EXISTS "anon_delete_complaints" ON complaints;

-- New DELETE policy: only authenticated users can delete
CREATE POLICY "authenticated_delete_complaints" ON complaints FOR DELETE
  TO authenticated USING (true);

-- SELECT and INSERT stay open to anon + authenticated (public map + anonymous reporting)
-- These policies already exist and remain unchanged.

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can read the admin_users table (to verify admin status)
DROP POLICY IF EXISTS "admins_read_admin_users" ON admin_users;
CREATE POLICY "admins_read_admin_users" ON admin_users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Add index on user_id for faster history queries
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id) WHERE user_id IS NOT NULL;