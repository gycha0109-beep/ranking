# P1-2.11 설계 리뷰 반영·최종 계약

이 문서는 최초 설계와 설계 리뷰의 차이를 해소하는 구현 기준이다. 충돌 시 이 문서가 우선한다.

## 1. 시스템 성격

- 기존 P1-2.10 원장: 실제 저장된 운영 결정의 authoritative audit
- 신규 P1-2.11 테이블: Operator Console이 관측한 실패의 bounded aggregate telemetry
- `source_trust`: 항상 `authenticated_self_report`
- 신규 집계는 직접 RPC·Gateway 차단 전체를 포착한다고 주장하지 않는다.

## 2. 최종 테이블 계약

`public.admin_security_event_buckets`

- 5분 UTC bucket
- actor는 `auth.uid()`에서만 결정
- 역할 snapshot 보존
- event kind: `permission_denied`, `validation_failed`, `conflict`, `command_failed`, `suspicious_query`
- 자유서술·payload·token·IP·User-Agent 미저장
- 대상은 UUID/BIGINT 최초·최근 표본만 저장
- 동일 actor/hour 신규 distinct bucket 최대 60개
- 초과분은 `suspicious_query / event_overflow / security_event_reporter / distinct_bucket_limit` 고정 키로 압축
- count·last seen·last subject만 갱신
- 90일 후 삭제

## 3. 기록 권한 계약

`public.record_admin_security_event(...)`

- authenticated execute 허용
- actor ID 인자 없음
- strict allowlist와 정규식 검증
- `private.record_admin_security_event(...)`가 advisory lock, 상한, upsert 수행
- reporter 실패는 원래 운영 요청 결과를 가리지 않는다.

직접 table/sequence 권한은 모두 제거한다.

## 4. capability 계약

- `security_event_view`: super_admin only
- `private.has_admin_capability()`와 `public.get_my_admin_access()`를 함께 변경
- list/overview RPC가 DB 내부에서 capability를 재검사

## 5. 조회 계약

`public.list_admin_security_events(...)`

- exact event kinds
- exact risk levels
- actor UUID
- exact action key
- `[from, to)`
- minimum occurrence 1~1,000,000
- `(last_seen_at DESC, id DESC)` cursor
- limit 1~100

반환:

- bucket/event 식별값
- actor 현재 label과 기록 시점 역할
- route/resource/action/failure code
- 대상 최초·최근 표본
- first/last seen
- occurrence count
- risk level
- repeated 여부
- source trust

`public.get_admin_security_event_overview(p_hours)`

- 1~168시간
- total occurrences
- total buckets
- high/medium/low buckets
- repeated buckets
- 종류별 occurrence 합계

## 6. 위험도 계약

- high
  - overflow
  - permission denied ≥ 10
  - suspicious query ≥ 10
  - command failed ≥ 20
- medium
  - occurrence ≥ 5
  - permission denied, conflict, command failed 단발 이상
- low
  - 나머지

`is_repeated = occurrence_count >= 5`.

## 7. 애플리케이션 수집 계약

공통 helper:

- `reportAdminSecurityEvent`
- `requireAdminCapability(capability, context?)`
- `runAdminRpc(capability, rpcName, args, context?)`

명시적 전환 범위:

- 운영 역할 변경
- Moderation 결정
- 댓글 신고 결정
- 사용자 제재·해제
- 제재 이의제기 결정
- 감사 목록·상세 입력 검증
- 신규 보안 이벤트 목록 입력 검증

모든 error message, note, statement, body는 기록하지 않는다.

## 8. 운영 화면 계약

- `/admin/security-events`
- `security_event_view` 보유자만 접근
- 24시간 overview
- kind/risk/actor/action/date/min count 필터
- keyset next page
- 집계 telemetry라는 신뢰 수준 안내
- 대상은 표본으로 표시
- raw JSON 없음

## 9. 유지보수 계약

- job key: `prune_admin_security_events`
- cron name: `ranking-maint-prune-admin-security-events`
- schedule: `0 4 * * *`
- batch size 5000, max batches 10, timeout 30000ms
- retention: 90일
- 기존 maintenance runner case를 모두 보존
- 신규 cron만 선택적으로 재등록

## 10. 인덱스 계약

- `(last_seen_at DESC, id DESC)`
- `(event_kind, last_seen_at DESC, id DESC)`
- `(actor_id, last_seen_at DESC, id DESC)`
- `(action_key, last_seen_at DESC, id DESC)`
- `(bucket_started_at, actor_id, event_kind, action_key, resource_key, failure_code, route_key, subject_type)` unique

## 11. 검증 계약

- role matrix
- actor spoof 불가
- strict input rejection
- same-key aggregation
- target variation collapse
- distinct bucket overflow
- risk boundaries
- keyset no overlap
- overview consistency
- private/public privilege matrix
- 90-day prune and runner path
- transaction rollback fixture
- exact-head lint/build
- PR 생성 후 사용자 승인 전 병합 금지