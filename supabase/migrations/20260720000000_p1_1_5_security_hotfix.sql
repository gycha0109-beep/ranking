BEGIN;

-- P1-1.5-A: function execution boundaries and immutable search_path.
ALTER FUNCTION public.check_ranking_category_consistency() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.is_admin() SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.check_ranking_category_consistency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- is_admin() is required by RLS. Remove the implicit PUBLIC grant and grant only API roles.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

COMMIT;
