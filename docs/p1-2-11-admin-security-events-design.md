# P1-2.11 운영 보안 이벤트·실패 시도 감사 설계

## 1. 기준 상태

- authoritative `main`: `a69a3bc1ae17644768fa4637b9df4e60022791fa`
- P1-2.10은 성공하거나 실제 저장된 운영 결정을 기존 append-only 원장에서 상관관계 기반으로 조회한다.
- 권한 거부, 입력 검증 실패, 동시성 충돌, 운영 RPC 실패와 비정상 감사 조회 시도는 현재 운영 감사 원장에 남지 않는다.
- PostgreSQL 함수가 예외를 발생시키면 동일 트랜잭션에서 작성한 로그도 롤백된다. 따라서 기존 RPC 내부에서 `INSERT` 후 예외를 다시 발생시키는 방식은 실패 감사에 사용할 수 없다.

## 2. 목적

다음 실패 신호를 민감 원문 없이 제한적으로 수집하고 최고 관리자만 조회할 수 있게 한다.

1. 운영 capability 거부
2. 고위험 운영 RPC의 validation·대상 없음·충돌·권한·기타 실패
3. 감사·보안 이벤트 조회의 잘못된 필터와 식별자 시도
4. 동일 실패의 반복 횟수와 최초·최근 발생 시각
5. 보존기간 경과 데이터의 자동 삭제

이 단계는 침입 탐지 시스템이나 외부 SIEM을 만들지 않는다. Operator Console 서버 액션이 관측한 실패를 데이터베이스에 집계하는 범위다.

## 3. 수집 경계

### 수집 대상

- 공통 `requireAdminCapability()`가 거부한 모든 운영 화면·서버 액션 접근
- 역할 변경
- Moderation 결정
- 댓글 신고 결정
- 사용자 제재·해제
- 제재 이의제기 결정
- 운영 감사 조회의 잘못된 event kind, ID, UUID, 기간, cursor
- 신규 보안 이벤트 조회의 잘못된 필터
- 위 고위험 RPC가 반환한 SQLSTATE 기반 실패

### 비범위

- Supabase Gateway 이전 단계에서 차단된 요청
- Operator Console을 거치지 않은 임의의 직접 REST/RPC 호출 전체
- IP 주소, User-Agent, 토큰, 쿠키, 요청 본문, 자유서술 메모 저장
- 자동 계정 제재·자동 차단
- 실시간 외부 알림과 SIEM 전송

직접 RPC 시도를 완전하게 포착하려면 플랫폼 로그 수집 또는 별도 비동기 경로가 필요하다. 이번 단계는 이를 과장하지 않는다.

## 4. 데이터 모델

`public.admin_security_event_buckets`

- `id BIGINT IDENTITY`
- `bucket_started_at TIMESTAMPTZ`: UTC 5분 버킷 시작
- `actor_id UUID`: `auth.uid()`에서만 결정
- `actor_role_level TEXT`: 기록 시점 역할 snapshot
- `event_kind TEXT`
  - `permission_denied`
  - `validation_failed`
  - `conflict`
  - `command_failed`
  - `suspicious_query`
- `action_key TEXT`: RPC 또는 고정 동작 식별자
- `resource_key TEXT`: 요구 capability 또는 운영 자원
- `failure_code TEXT`: SQLSTATE 또는 고정 코드
- `route_key TEXT`: 동적 ID가 제거된 `/admin/...` 내부 경로
- `subject_type TEXT`: `user`, `comment`, `sanction`, `appeal`, `audit_event`, `none` 등
- `sample_subject_ref TEXT`: 버킷 최초 대상 UUID/BIGINT 표본
- `last_subject_ref TEXT`: 버킷 최근 대상 UUID/BIGINT 표본
- `first_seen_at`, `last_seen_at`
- `occurrence_count INTEGER`

고유 집계 키:

`bucket_started_at + actor_id + event_kind + action_key + resource_key + failure_code + route_key + subject_type`

대상 ID는 고유 키에서 제외한다. 공격자가 대상만 바꿔 행을 무한 생성하는 것을 막고, 최초·최근 표본만 보존한다.

## 5. 기록 RPC

### `public.record_admin_security_event(...)`

- `authenticated`만 실행 가능하다.
- actor는 인자로 받지 않고 `auth.uid()`에서 결정한다.
- 역할은 `private.get_admin_role_level()`에서 snapshot한다.
- 성공 이벤트는 받지 않는다.
- 모든 문자열은 allowlist 정규식과 길이 제한을 적용한다.
- 자유서술 메시지와 임의 JSON은 받지 않는다.
- 대상 참조는 UUID 또는 19자리 이하 숫자만 허용한다.
- 5분 버킷에 upsert하여 `occurrence_count`와 최근 시각만 갱신한다.
- 한 actor가 최근 1시간에 60개를 넘는 서로 다른 버킷을 만들려 하면 나머지는 고정 `event_overflow` 버킷으로 압축한다.

테이블 직접 권한은 `PUBLIC`, `anon`, `authenticated`에서 모두 제거한다.

## 6. 애플리케이션 수집

`src/lib/actions/admin-access.ts`에 다음 공통 기능을 둔다.

- `reportAdminSecurityEvent()`: 실패해도 원래 요청 결과를 가리지 않는 best-effort 기록
- `requireAdminCapability(capability, context)`: 거부 시 `permission_denied` 기록
- `runAdminRpc(capability, rpcName, args, context)`: RPC error의 SQLSTATE를 분류하여 기록

SQLSTATE 분류:

- `42501` → `permission_denied`
- `40001`, `40P01`, `55P03`, `23505` → `conflict`
- `22...`, `23...`, `P0002` → `validation_failed`
- 그 외 → `command_failed`

민감한 `error.message`와 입력 원문은 기록하지 않는다.

## 7. 조회 권한과 RPC

신규 capability:

- `security_event_view`: `super_admin` only

신규 RPC:

- `public.list_admin_security_events(...)`
  - event kind, risk level, actor UUID, action key, 기간, 최소 발생 횟수
  - `(last_seen_at DESC, id DESC)` keyset pagination
  - 최대 100건
- `public.get_admin_security_event_overview(p_hours)`
  - 최근 1~168시간 총 발생 수
  - high/medium/low 버킷 및 반복 버킷 수
  - 종류별 발생 수

위 함수는 데이터베이스 내부에서 `security_event_view`를 다시 검사한다.

## 8. 반복 탐지와 위험도

자동 제재가 아닌 조회용 휴리스틱만 계산한다.

- `high`
  - `permission_denied` 10회 이상
  - `suspicious_query` 10회 이상
  - `event_overflow`
  - `command_failed` 20회 이상
- `medium`
  - 모든 종류 5회 이상
  - `permission_denied`, `conflict`, `command_failed` 단발 이상
- `low`
  - 그 외

`is_repeated`는 `occurrence_count >= 5`다.

## 9. 운영 화면

`/admin/security-events`

- 24시간 overview 카드
- event kind·risk·actor·action·기간·최소 횟수 필터
- actor ID, 기록 시점 역할, 경로, 실패 코드, 대상 표본, 최초·최근 시각, 횟수 표시
- keyset 다음 페이지
- raw JSON과 자유서술 원문 없음

`/admin` 메뉴에는 `security_event_view` 보유자에게만 표시한다.

## 10. 보존 정책

- 90일 보존
- `private.prune_admin_security_event_buckets_batch()`로 bounded delete
- `maintenance_job_definitions`에 `prune_admin_security_events` 등록
- 매일 04:00 UTC 실행
- 기존 `private.run_maintenance_job()` case와 pg_cron schedule에 연결
- 유지보수 실행 자체는 기존 P1-2.10 감사 스트림에 남는다.

## 11. 검증 기준

1. 일반 사용자·moderator·admin은 조회 RPC가 `42501`
2. super admin만 목록과 overview 조회 가능
3. reporter가 actor를 위조할 수 없음
4. 민감 문자열·임의 JSON 입력 경로가 없음
5. 동일 키 5분 반복은 한 행의 count 증가
6. 대상 ID 변경만으로 새 행이 생성되지 않음
7. 1시간 distinct bucket 상한 이후 overflow로 압축
8. keyset 페이지 중복 0
9. risk 계산 경계 검증
10. 90일 prune과 maintenance runner 연결 검증
11. 기존 감사·관리 기능 회귀 없음
12. lint와 production build 성공