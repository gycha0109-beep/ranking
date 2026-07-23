# P1-2.5 댓글 신고·운영 제재 검증

## 기준선

- base main: `39363b8a635b3cf75d7f955308120546e78fd627`
- branch: `feat/p1-2-5-comment-reports`

## 정적 검증

- 설계 문서와 설계 리뷰 존재
- 사용자 신고 액션 및 신고 폼 존재
- 댓글 목록 RPC 결과에 `reported_by_me` 상태 통합
- 관리자 신고 큐, 처리 액션, 대시보드 진입점 존재
- 스키마·사용자 RPC·관리자 RPC 마이그레이션 분리

## 호스팅 DB 검증

확인된 SECURITY DEFINER RPC:

- `create_comment_report(uuid,text,text)`
- `get_my_comment_report_states(uuid[])`
- `get_pending_comment_report_case_count()`
- `list_comment_report_queue(integer,integer)`
- `review_comment_report_case(uuid,integer,text,text,text,text)`

확인된 권한:

- `comment_reports`에 anon/authenticated 직접 테이블 권한 없음
- `comment_report_decisions`에 anon/authenticated 직접 테이블 권한 없음
- 사용자·관리자 기능은 승인된 RPC를 통해서만 접근

확인된 계약:

- 관리자 큐는 신고자 ID를 반환하지 않음
- 관리자 처리는 expected pending count를 요구
- 신고 처리 결과와 작성자 경고가 별도 감사 결정에 기록됨
- 숨김·차단은 기존 댓글 Moderation 감사 흐름과 연결됨

## 잔여 검증

- PR CI에서 `npm ci`, lint, build 통과 확인
- 실제 사용자 세션 기반 생성·중복·자기 신고·Rate Limit smoke test
- 관리자 세션 기반 stale count·기각·유지·숨김·차단 smoke test

## 판정 기준

CI와 세션 기반 smoke test가 모두 통과하면 P1-2.5를 병합 가능 상태로 판정한다.
