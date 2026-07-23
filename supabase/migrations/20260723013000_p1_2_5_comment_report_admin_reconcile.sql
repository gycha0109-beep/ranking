BEGIN;

-- Reconcile legacy/partial P1-2.5 admin RPC signatures before establishing the final contract.
DROP FUNCTION IF EXISTS public.get_pending_comment_report_case_count();
DROP FUNCTION IF EXISTS public.list_comment_report_queue(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.review_comment_report_case(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.review_comment_report_case(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT);

-- Re-apply the canonical definitions from the preceding admin RPC migration.
\i 20260723012000_p1_2_5_comment_report_admin_rpcs.sql

COMMIT;
