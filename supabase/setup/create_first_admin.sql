-- =====================================================================
-- Grant staff access to an EXISTING Supabase Auth user.
--
-- 1. First create the user in the Supabase Dashboard:
--    Authentication → Users → "Add user" → "Create new user"
--    (enter their email + a strong password, tick "Auto Confirm User").
-- 2. Replace the email and name below, then run this whole file in
--    Dashboard → SQL Editor.
--
-- Only someone with access to the Supabase project can run this, which is
-- what keeps staff access out of reach of the public website.
-- Use role 'admin' (can export CSV) or 'staff' (view only).
-- =====================================================================

insert into public.staff_members (user_id, role, full_name)
select id, 'admin', 'Your Name'
from auth.users
where email = 'you@example.com'
on conflict (user_id) do update set role = excluded.role, full_name = excluded.full_name;

-- Check it worked (should return one row):
select s.role, s.full_name, u.email
from public.staff_members s join auth.users u on u.id = s.user_id;

-- To remove someone's access later:
-- delete from public.staff_members where user_id = (select id from auth.users where email = 'person@example.com');
