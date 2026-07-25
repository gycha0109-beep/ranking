# P1-2.11 운영 보안 이벤트·실패 시도 감사 설계 리뷰

## 리뷰 결론

별도 실패 신호 집계와 최고 관리자 전용 조회 방향은 타당하다. 특히 PostgreSQL 예외 롤백 특성을 인정하고 Operator Console이 관측한 실패를 후속 RPC로 기록하는 경계가 현실적이다. 다만 최초 설계는 이벤트 진위, 집계 경쟁, overflow 처리, 조회 성능과 용어를 보완해야 한다.

## 발견 사항과 보완

### 1. authoritative audit와 telemetry 혼동

인증된 사용자는 public reporter를 직접 호출할 수 있으므로 행위자를 위조할 수는 없지만 자신의 실패 신호를 임의 생성할 수 있다.

- 이 테이블은 법적·보안상 authoritative 원장이 아니라 `authenticated_self_report` 운영 telemetry로 정의한다.
- `source_trust`는 입력받지 않고 고정값으로 저장한다.
- 화면에서 기존 운영 감사 원장과 동일한 증거 수준으로 표현하지 않는다.
- 외부 Gateway·직접 RPC 전체 포착을 보장하지 않는다.

### 2. 집계 테이블의 변경 가능성

동일 버킷 count를 갱신하고 90일 후 삭제하므로 append-only 원장이 아니다.

- 문서와 UI에서 “보안 이벤트 집계”로 명명한다.
- 테이블 직접 권한을 제거하고 SECURITY DEFINER 함수만 upsert·delete한다.
- 기존 P1-2.10 감사 원장과 분리한다.

### 3. distinct bucket 상한의 경쟁 조건

동시에 여러 reporter가 실행되면 최근 1시간 행 수 검사 후 모두 신규 행을 만들 수 있다.

- `actor_id + UTC hour`를 기준으로 transaction advisory lock을 획득한다.
- 기존 집계 키가 있는지는 상한 검사 전에 확인한다.
- 신규 키이며 최근 1시간 bucket 수가 60개 이상일 때만 overflow 키로 치환한다.

### 4. 5분 버킷 계산

문자열 truncation이나 세션 timezone에 의존하면 경계가 달라질 수 있다.

- `date_bin(INTERVAL '5 minutes', clock_timestamp(), TIMESTAMPTZ '2000-01-01 00:00:00+00')`를 사용한다.
- `first_seen_at`, `last_seen_at`에는 실제 관측 시각을 저장한다.

### 5. 대상 ID를 고유 키에서 제외할 때의 의미

대상 변경을 압축하면 한 버킷에 여러 대상이 섞일 수 있다.

- `sample_subject_ref`는 최초 표본으로 유지한다.
- `last_subject_ref`만 최근 값으로 갱신한다.
- UI에 “표본”이라고 명시한다.
- 대상별 정확한 사건 추적이 필요하면 P1-2.10 authoritative audit로 이동한다.

### 6. 입력 정규화

임의 문자열을 허용하면 로그 인젝션과 고카디널리티가 생긴다.

- `event_kind`와 `risk`는 고정 allowlist다.
- `action_key`, `resource_key`, `failure_code`는 소문자 영숫자·점·밑줄·하이픈만 허용하고 최대 80자다.
- `route_key`는 동적 segment가 없는 `/admin` 하위 경로만 허용하고 최대 120자다.
- `subject_type`은 같은 제한으로 최대 40자다.
- subject ref는 UUID 또는 1~19자리 숫자만 허용한다.
- error message, note, query text, payload JSON은 받지 않는다.

### 7. permission denied 중복 기록

`requireAdminCapability()` 거부와 실제 RPC의 `42501`을 모두 기록할 수 있다.

- capability precheck가 거부되면 RPC는 실행하지 않으므로 한 번만 기록된다.
- precheck는 통과했지만 DB 내부 세부 capability가 거부한 경우 `runAdminRpc()`가 별도 `42501`을 기록한다.
- action key를 각각 `capability_check`와 실제 RPC 이름으로 구분한다.

### 8. 모든 실패 포착 과장 방지

공통 helper를 사용하지 않는 기존 직접 Supabase 호출과 browser→PostgREST 직접 호출은 누락될 수 있다.

- 이번 구현에서 역할, Moderation, 신고, 제재, 이의제기, 감사 조회 경로를 명시적으로 전환한다.
- 일반 콘텐츠 CRUD 전체를 완료했다고 주장하지 않는다.
- 공통 helper는 후속 운영 액션이 쉽게 편입되도록 제공한다.

### 9. SQLSTATE 분류 순서

`23505`는 validation 계열이면서 충돌 의미도 있다.

- conflict 목록을 validation prefix보다 먼저 검사한다.
- `P0002`는 invalid target으로 validation에 포함한다.
- 코드가 없거나 예상 밖이면 `command_failed / unknown`으로 정규화한다.

### 10. 조회 성능

risk는 occurrence count와 event kind로 계산되므로 저장하지 않고 query 시 계산한다.

- 기본 keyset index: `(last_seen_at DESC, id DESC)`
- event kind 조회: `(event_kind, last_seen_at DESC, id DESC)`
- actor 조회: `(actor_id, last_seen_at DESC, id DESC)`
- action exact 조회: `(action_key, last_seen_at DESC, id DESC)`
- 최대 보존 90일과 distinct 상한으로 cardinality를 제한한다.
- limit 1~100, overview 1~168시간을 DB에서 강제한다.

### 11. risk 필터 구현

alias를 같은 SELECT의 WHERE에서 사용할 수 없다.

- private query에서 base CTE → classified CTE 순서로 계산한다.
- public RPC는 입력 검증과 capability 확인 후 private query를 호출한다.

### 12. RLS와 function 권한

- 테이블 RLS를 활성화하고 policy를 만들지 않는다.
- 테이블 sequence 포함 직접 권한을 제거한다.
- private record/list/prune 함수는 `PUBLIC`, `anon`, `authenticated`에서 revoke한다.
- public reporter만 authenticated에 grant한다.
- public list/overview는 authenticated에 grant하되 내부 capability를 재검사한다.

### 13. 유지보수 runner 교체 위험

`private.run_maintenance_job()`을 재정의할 때 기존 case를 누락하면 다른 cron이 깨진다.

- 현재 main의 전체 case를 그대로 보존하고 `prune_admin_security_events`만 추가한다.
- 특정 신규 cron 이름만 unschedule 후 재등록한다.
- 기존 cron 전체를 다시 등록하지 않는다.

### 14. Hosted validation fixture

실패 telemetry는 운영 데이터에 남기지 않아야 한다.

- reporter·권한·집계 테스트는 transaction 내부에서 수행하고 rollback한다.
- maintenance prune도 임시 과거 bucket을 transaction에서 생성해 검증한다.
- 실제 서비스 계정의 기존 이벤트를 수정하지 않는다.

## 최종 구현 조건

1. `authenticated_self_report` 신뢰 수준 명시
2. 집계 telemetry와 authoritative audit 분리
3. actor/hour advisory lock
4. `date_bin` UTC 5분 버킷
5. 최초·최근 대상 표본 분리
6. strict allowlist와 원문 비저장
7. precheck와 DB 거부 action 구분
8. 명시된 고위험 경로만 완료 범위로 선언
9. conflict 우선 SQLSTATE 분류
10. 최소 인덱스와 강제 limit
11. CTE 기반 risk 필터
12. RLS·execute 권한 최소화
13. 기존 maintenance case 완전 보존
14. Hosted fixture 완전 rollback