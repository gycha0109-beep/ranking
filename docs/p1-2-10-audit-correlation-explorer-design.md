# P1-2.10 운영 감사 상관관계·근거 탐색 설계

## 1. 기준 상태

- authoritative `main`: `900d8f5d08ba1a56f37fab5fe2ac2f086fd67790`
- P1-2.8에서 역할 변경, 수동 Moderation, 댓글 신고 결정, 제재, 이의제기 결정을 합친 `list_admin_audit_events`와 `/admin/audit` 화면이 도입됐다.
- P1-2.9에서 유지보수 실행 원장이 같은 감사 목록에 추가됐다.
- 현재 감사 목록은 최근 150건 고정 offset 조회이며, 이벤트 종류·행위자·대상·기간·사건 단위 검색과 안정적인 다음 페이지 조회가 없다.
- 현재 목록 `details`에는 운영 메모가 그대로 포함되어 목록 화면에서 과도하게 노출된다.

## 2. 목적

기존 원장들을 복제하는 범용 감사 테이블을 새로 만들지 않고, append-only 원장을 authoritative source로 유지한 채 다음 기능을 추가한다.

1. 행위자, 대상, 조치, 결정 근거를 정규화한다.
2. 서로 관련된 Moderation·신고·제재·이의제기 이벤트를 deterministic correlation ID로 묶는다.
3. 이벤트 종류, 행위자 UUID, 대상 UUID, correlation ID, 기간으로 검색한다.
4. offset 대신 안정적인 keyset pagination을 사용한다.
5. 목록에는 최소 정보만 노출하고, 민감 운영 메모는 최고 관리자만 상세 조회한다.
6. 감사 상세에서 원본 원장과 같은 사건의 관련 이벤트를 추적한다.

## 3. 비범위

- 기존 append-only 원장의 데이터 복제 또는 재작성
- 외부 SIEM, 이메일, Slack 전송
- IP 주소, user-agent, 세션 토큰 수집
- 운영자 화면에서 원장 수정·삭제
- 과거 행위자의 표시 이름 snapshot backfill
- 2인 승인 또는 운영 결정 취소 기능

## 4. 보안 원칙

### 4.1 권한

- `audit_view`: 정규화된 감사 목록과 비민감 상세 조회. `admin`, `super_admin`.
- `audit_sensitive_view`: review note, sanction admin note, appeal statement, maintenance error message 등 민감 근거 조회. `super_admin` 전용.
- 브라우저 역할은 원본 원장 테이블에 직접 접근하지 않는다.
- RPC는 `SECURITY DEFINER`와 고정 `search_path`를 사용한다.

### 4.2 목록 최소화

목록에는 다음만 반환한다.

- event kind 및 source event ID
- correlation ID
- actor UUID와 현재 표시 이름
- subject type, UUID, 현재 표시 이름 또는 안정적인 식별 라벨
- action
- reason code
- 민감 원문을 포함하지 않는 summary
- 내부 상세 링크
- 생성 시각

review note, admin note, appeal statement, maintenance error message는 목록에 포함하지 않는다.

### 4.3 상세 노출

- 일반 `audit_view` 상세은 상태 전환, reason code, source reference와 수치 정보만 반환한다.
- `audit_sensitive_view`가 있는 경우에만 민감 텍스트를 `sensitive_evidence`에 포함한다.
- 입력 본문, 신고자 목록, 이메일, 토큰, IP는 반환하지 않는다.

## 5. 상관관계 계약

correlation ID는 원장 행에서 결정적으로 계산한다. 별도 mutable mapping을 두지 않는다.

| 이벤트 | correlation ID |
|---|---|
| 역할 변경 | `user:<target_user_id>` |
| 댓글 Moderation | `comment:<comment_id>` |
| 랭킹·아이템·이미지 Moderation | `moderation:<entity_type>:<entity_id>` |
| 댓글 신고 결정 | `comment:<comment_id>` |
| 제재 이벤트 | `sanction:<sanction_id>` |
| 이의제기 결정 | `sanction:<sanction_id>` |
| 유지보수 실행 | `maintenance:<job_key>` |

제재가 댓글·신고 결정·Moderation review를 근거로 생성된 경우 상세 RPC는 `source_correlations`를 추가 반환한다.

- `comment:<source_comment_id>`
- 신고 결정의 `comment_id`에서 계산한 `comment:<id>`
- Moderation review의 entity에서 계산한 correlation

이로써 제재 자체 흐름과 원본 콘텐츠 사건을 모두 탐색할 수 있다.

## 6. 데이터베이스 계약

### 6.1 `private.admin_audit_event_stream()`

각 append-only 원장을 동일한 컬럼으로 정규화하는 private set-returning function이다.

반환 컬럼:

- `event_kind TEXT`
- `event_id TEXT`
- `sort_key TEXT`
- `correlation_id TEXT`
- `actor_id UUID`
- `actor_label TEXT`
- `subject_type TEXT`
- `subject_id UUID`
- `subject_label TEXT`
- `action TEXT`
- `reason_code TEXT`
- `summary TEXT`
- `source_href TEXT`
- `created_at TIMESTAMPTZ`

이 함수는 API 역할에서 execute 권한을 회수한다.

### 6.2 `public.list_admin_audit_events_v2(...)`

인자:

- `p_event_kinds TEXT[] DEFAULT NULL`
- `p_actor_id UUID DEFAULT NULL`
- `p_subject_id UUID DEFAULT NULL`
- `p_correlation_id TEXT DEFAULT NULL`
- `p_from TIMESTAMPTZ DEFAULT NULL`
- `p_to TIMESTAMPTZ DEFAULT NULL`
- `p_cursor_created_at TIMESTAMPTZ DEFAULT NULL`
- `p_cursor_sort_key TEXT DEFAULT NULL`
- `p_limit INTEGER DEFAULT 50`

검증:

- event kind는 허용 목록만 수락한다.
- correlation ID는 200자 이하, 제어문자 없음.
- `p_from < p_to`.
- cursor 시각과 sort key는 둘 다 있거나 둘 다 없어야 한다.
- limit는 1~100.

정렬과 cursor:

```text
ORDER BY created_at DESC, sort_key DESC
WHERE cursor IS NULL
   OR (created_at, sort_key) < (cursor_created_at, cursor_sort_key)
```

기존 `list_admin_audit_events(integer, integer)`는 호환성을 위해 유지하되 민감 note를 제거한 최소 summary만 반환하도록 재정의한다. 신규 화면은 v2만 사용한다.

### 6.3 `public.get_admin_audit_event_detail(event_kind, event_id)`

JSONB 반환:

- `event`: 공통 정규화 필드
- `evidence`: 비민감 원장 필드
- `sensitive_evidence`: 최고 관리자만 실제 값, 그 외 `null`
- `source_correlations`: 관련 사건 correlation 배열
- `related_events`: 동일 correlation의 최근 50개 정규화 이벤트
- `can_view_sensitive`: boolean

존재하지 않는 event kind 또는 ID는 `P0002`, 잘못된 입력은 `22023`을 사용한다.

## 7. 이벤트 정규화

### 역할 변경

- actor: `actor_id`
- subject: target user
- action: `previous_level -> new_level`
- reason code: `role_change`
- source href: `/admin/access-control`

### 수동 Moderation

- 자동 Moderation은 통합 운영 감사에서 제외하고 `decision_source = manual`만 포함한다.
- actor: `reviewed_by`
- subject: entity
- action: decision status
- reason code: decision reason
- source href는 comment면 `/admin/comments`, 그 외 `/admin/rankings`

### 댓글 신고 결정

- actor: `reviewed_by`
- subject: comment
- action: resolution
- reason code: decision reason
- source href: `/admin/comment-reports`

### 제재 이벤트

- actor: event actor. 자연 만료는 시스템.
- subject: target user
- action: imposed, revoked, expired, overturned
- reason code: sanction reason
- source href: `/admin/user-sanctions`

### 이의제기 결정

- actor: reviewed_by
- subject: appellant
- action: accepted 또는 rejected
- reason code: `appeal_decision`
- correlation: sanction ID
- source href: `/admin/user-sanctions`

### 유지보수 실행

- actor: null, 시스템
- subject type: `maintenance_job`
- subject ID: null
- subject label: job key
- action: status
- reason code: error code 또는 null
- source href: `/admin/maintenance`

## 8. 애플리케이션 계약

### 서버 액션

`src/lib/actions/admin-access.ts`에 typed 계약을 추가한다.

- `AdminAuditEvent`
- `AdminAuditFilters`
- `AdminAuditCursor`
- `listAdminAuditEventsV2(filters)`
- `getAdminAuditEventDetail(kind, id)`

입력은 서버에서 다시 정규화한다.

- event kind allowlist
- UUID 형식
- ISO timestamp
- correlation 길이
- limit 상한

### `/admin/audit`

- GET search params 기반 필터
- 이벤트 종류 multi-select
- actor UUID, subject UUID, correlation ID
- 시작·종료 시각
- 필터 초기화
- correlation ID 클릭 시 같은 사건으로 재검색
- source workspace 링크
- `다음 기록` keyset 링크
- raw JSON `<pre>` 제거

### `/admin/audit/[eventKind]/[eventId]`

- 공통 행위 정보
- 비민감 근거
- 최고 관리자 전용 민감 근거
- source correlation 링크
- 동일 correlation 관련 이벤트
- 원본 운영 화면 링크

경로는 middleware의 기존 `/admin/audit` capability 보호에 포함되므로 추가 prefix 정책 없이 하위 경로에도 `audit_view`를 적용한다.

## 9. 인덱스 전략

원본 원장의 기존 PK와 시간 인덱스를 우선 재사용한다. Hosted `EXPLAIN`과 인덱스 목록을 확인한 뒤 부족한 경우에만 추가한다.

후보:

- `moderation_reviews(reviewed_at DESC, id DESC) WHERE decision_source='manual'`
- `comment_report_decisions(created_at DESC, id DESC)`
- `user_sanction_events(created_at DESC, id DESC)`
- `user_sanction_appeal_decisions(created_at DESC, id DESC)`
- `admin_role_change_events(created_at DESC, id DESC)`
- `maintenance_job_runs(finished_at DESC, id DESC)`

actor 또는 subject 단독 필터 인덱스는 실제 행 수와 query plan 확인 후 결정한다.

## 10. 검증 계획

### Hosted 기능 검증

1. 기본 목록이 모든 6종 원장을 시간순으로 반환한다.
2. raw note가 목록 결과에 포함되지 않는다.
3. event kind, actor, subject, correlation, 기간 필터가 정확하다.
4. keyset 1·2페이지에 중복과 누락이 없다.
5. 동일 comment correlation에서 Moderation과 신고 결정이 함께 조회된다.
6. sanction correlation에서 imposed·appeal decision·overturned가 연결된다.
7. admin 상세에는 `sensitive_evidence = null`이다.
8. super admin 상세에는 허용된 민감 근거가 반환된다.
9. anon, 일반 authenticated, moderator는 RPC 실행이 거부된다.
10. private stream은 API 역할에서 실행할 수 없다.
11. 원본 원장 UPDATE·DELETE 차단은 유지된다.

### 애플리케이션 검증

- lint
- production build
- 필터 URL 직렬화
- 잘못된 query param의 안전한 무시 또는 오류 표시
- 상세 route의 없는 이벤트 처리
- source href가 내부 허용 경로만 사용

## 11. 완료 조건

- 기존 원장이 authoritative source로 유지된다.
- 신규 generic audit write table이 없다.
- actor·subject·reason·correlation이 typed field로 반환된다.
- 목록의 민감 원문 노출이 제거된다.
- keyset pagination과 필터가 Hosted에서 검증된다.
- 상세 근거는 capability에 따라 분리된다.
- exact-head CI 성공 후 PR을 생성한다.
- 사용자 명시적 승인 전에는 병합하지 않는다.
