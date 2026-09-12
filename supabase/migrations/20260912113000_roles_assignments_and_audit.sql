-- Role-based access, task assignment and an auditable history for the municipal staff.
-- Create the first superadmin in Supabase Auth (Dashboard/API), then run:
-- insert into public.admin_users (id, email, display_name, role)
-- values ('AUTH_USER_UUID', 'admin@example.com', 'Superadmin', 'superadmin');

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin'
    CHECK (role IN ('admin', 'superadmin')),
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND role = 'superadmin' AND active = true
  );
$$;

-- A profile is made automatically for every Auth account. It lets superadmins
-- manage platform access without exposing auth.users to the browser.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name)
  VALUES (NEW.id, COALESCE(NEW.email, ''), NEW.raw_user_meta_data ->> 'display_name')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_profile ON auth.users;
CREATE TRIGGER on_auth_user_profile
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_profile();

INSERT INTO public.user_profiles (id, email)
SELECT id, COALESCE(email, '') FROM auth.users
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.complaint_assignments (
  complaint_id uuid PRIMARY KEY REFERENCES public.complaints(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.admin_users(id),
  assigned_by uuid NOT NULL REFERENCES public.admin_users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admin_users(id),
  complaint_id uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('assigned', 'status_changed', 'completed', 'unassigned', 'account_changed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_date ON public.admin_activity_log (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_complaint ON public.admin_activity_log (complaint_id, created_at DESC);

DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
CREATE POLICY "users_read_own_profile" ON public.user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_superadmin());
DROP POLICY IF EXISTS "superadmins_manage_profiles" ON public.user_profiles;
CREATE POLICY "superadmins_manage_profiles" ON public.user_profiles FOR UPDATE TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "admins_read_admin_users" ON public.admin_users;
CREATE POLICY "admins_read_admin_users" ON public.admin_users FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_superadmin());
DROP POLICY IF EXISTS "superadmins_manage_admin_users" ON public.admin_users;
CREATE POLICY "superadmins_manage_admin_users" ON public.admin_users FOR UPDATE TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "admins_read_assignments" ON public.complaint_assignments;
CREATE POLICY "admins_read_assignments" ON public.complaint_assignments FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "admins_read_activity" ON public.admin_activity_log;
CREATE POLICY "admins_read_activity" ON public.admin_activity_log FOR SELECT TO authenticated
  USING (admin_id = auth.uid() OR public.is_superadmin());

-- Only server-side RPCs change a complaint. This prevents ordinary accounts
-- from changing statuses or deleting other citizens' reports.
DROP POLICY IF EXISTS "authenticated_update_complaints" ON public.complaints;
DROP POLICY IF EXISTS "authenticated_delete_complaints" ON public.complaints;

CREATE OR REPLACE FUNCTION public.take_complaint(p_complaint_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Nuk keni qasje administratori'; END IF;
  INSERT INTO public.complaint_assignments (complaint_id, admin_id, assigned_by)
  VALUES (p_complaint_id, auth.uid(), auth.uid())
  ON CONFLICT (complaint_id) DO UPDATE SET admin_id = EXCLUDED.admin_id, assigned_by = EXCLUDED.assigned_by,
    assigned_at = now(), completed_at = NULL;
  INSERT INTO public.admin_activity_log (admin_id, complaint_id, action)
  VALUES (auth.uid(), p_complaint_id, 'assigned');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_complaint_status(p_complaint_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() OR p_status NOT IN ('pranuar', 'ne_punim', 'zgjidhur') THEN
    RAISE EXCEPTION 'Veprim i palejuar';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.complaint_assignments WHERE complaint_id = p_complaint_id AND admin_id = auth.uid())
     AND NOT public.is_superadmin() THEN RAISE EXCEPTION 'Merreni rastin para se ta përditësoni'; END IF;
  UPDATE public.complaints SET status = p_status WHERE id = p_complaint_id;
  UPDATE public.complaint_assignments SET completed_at = CASE WHEN p_status = 'zgjidhur' THEN now() ELSE NULL END
    WHERE complaint_id = p_complaint_id;
  INSERT INTO public.admin_activity_log (admin_id, complaint_id, action, details)
  VALUES (auth.uid(), p_complaint_id, CASE WHEN p_status = 'zgjidhur' THEN 'completed' ELSE 'status_changed' END,
    jsonb_build_object('status', p_status));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_account_active(p_user_id uuid, p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() OR p_user_id = auth.uid() THEN RAISE EXCEPTION 'Veprim i palejuar'; END IF;
  UPDATE public.user_profiles SET active = p_active, updated_at = now() WHERE id = p_user_id;
  UPDATE public.admin_users SET active = p_active, updated_at = now() WHERE id = p_user_id;
  INSERT INTO public.admin_activity_log (admin_id, action, details)
  VALUES (auth.uid(), 'account_changed', jsonb_build_object('user_id', p_user_id, 'active', p_active));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_admin_access(p_user_id uuid, p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  IF NOT public.is_superadmin() OR p_user_id = auth.uid() THEN RAISE EXCEPTION 'Veprim i palejuar'; END IF;
  SELECT email INTO v_email FROM public.user_profiles WHERE id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Llogaria nuk ekziston'; END IF;
  IF p_enabled THEN
    INSERT INTO public.admin_users (id, email, role, active)
    VALUES (p_user_id, v_email, 'admin', true)
    ON CONFLICT (id) DO UPDATE SET active = true, role = CASE WHEN admin_users.role = 'superadmin' THEN 'superadmin' ELSE 'admin' END, updated_at = now();
  ELSE
    DELETE FROM public.admin_users WHERE id = p_user_id AND role = 'admin';
  END IF;
  INSERT INTO public.admin_activity_log (admin_id, action, details)
  VALUES (auth.uid(), 'account_changed', jsonb_build_object('user_id', p_user_id, 'admin_access', p_enabled));
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_account(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.is_superadmin() OR p_user_id = auth.uid() THEN RAISE EXCEPTION 'Veprim i palejuar'; END IF;
  INSERT INTO public.admin_activity_log (admin_id, action, details)
  VALUES (auth.uid(), 'account_changed', jsonb_build_object('user_id', p_user_id, 'deleted', true));
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.take_complaint(uuid), public.update_complaint_status(uuid, text), public.set_account_active(uuid, boolean), public.set_admin_access(uuid, boolean), public.delete_account(uuid) TO authenticated;
