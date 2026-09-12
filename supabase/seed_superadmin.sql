-- 1. In Supabase Dashboard create the staff account from Authentication > Users > Add user.
--    Do not use the public “Regjistrohu” form for this account.
-- 2. Replace the two placeholders below with that account's Auth UUID and email,
--    then run this query once in the Supabase SQL Editor.

INSERT INTO public.admin_users (id, email, display_name, role, active)
VALUES (
  'PASTE_AUTH_USER_UUID_HERE',
  'superadmin@your-domain.example',
  'Superadmin',
  'superadmin',
  true
)
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    role = 'superadmin',
    active = true,
    updated_at = now();
