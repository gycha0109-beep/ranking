# P1-1.5 Security Hotfix

## Scope

- 공개 Supabase 조회에서 내부 메모 및 moderation 감사 필드 차단
- 공개 페이지 조회를 세션 비의존 anon 전용 클라이언트로 분리
- 개발용 관리자 부트스트랩의 외부 Server Action 노출 제거
- 로그인 `next` 경로의 외부·프로토콜 상대 URL 차단
- 핵심 PostgreSQL 함수의 고정 `search_path` 및 직접 실행 권한 보강

## Database verification

- `anon` cannot select `ranking_entries.internal_note`
- `anon` cannot select `rankings.moderation_review_note`
- `anon` cannot select `items.moderation_review_note`
- `anon` can still select public ranking columns
- `anon` cannot execute `handle_new_user()`

## Validation

- `npm run lint`: PASS
- `npm run build`: PASS

## Remaining

- `public.is_admin()` is still a `SECURITY DEFINER` helper callable by API roles because existing RLS policies depend on it. Moving it to a non-exposed schema should be handled as a separate database security migration.
- Supabase leaked-password protection remains disabled and requires a dashboard configuration change.
