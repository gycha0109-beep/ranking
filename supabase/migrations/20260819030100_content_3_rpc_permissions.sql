BEGIN;

REVOKE ALL ON FUNCTION public.admin_get_ranking_revalidation_status(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_record_ranking_revalidation(UUID, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_ranking_revalidations(UUID, INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_get_ranking_revalidation_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_ranking_revalidation(UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_ranking_revalidations(UUID, INTEGER) TO authenticated;

COMMIT;
