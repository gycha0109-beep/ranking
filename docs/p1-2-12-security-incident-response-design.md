# P1-2.12 운영 보안 사건 대응·알림 설계

## 1. 기준 상태

- authoritative `main`: `60bda7e95c2fc3b2bc959ff2f9cd2ab165c85aa5`
- P1-2.10은 성공한 운영 결정과 유지보수 실행을 authoritative audit stream으로 제공한다.
- P1-2.11은 Operator Console이 관측한 실패를 5분 단위 `authenticated_self_report` 집계 telemetry로 저장한다.
- 현재는 고위험·반복 telemetry를 조회할 수 있지만, 사건 생성·담당 지정·확인·종결·재발 추적 기능이 없다.

## 2. 목적

P1-2.11 telemetry를 자동 판정해 운영자가 처리해야 할 보안 사건으로 전환하고, 사건의 전체 대응 흐름을 append-only 원장과 P1-2.10 감사 탐색에서 추적한다.

1. 반복 또는 고위험 보안 이벤트에서 사건을 자동 생성한다.
2. 동일 fingerprint의 미종결 사건을 하나로 유지한다.
3. 알림 cooldown으로 반복 신호가 운영 화면을 도배하지 않게 한다.
4. 최고 관리자가 사건을 확인하고 담당자를 지정하며 종결한다.
5. 사건 상태 변경을 append-only 원장에 저장한다.
6. `/admin`에서 미처리 사건 수를 표시한다.
7. P1-2.10 감사 stream과 P1-2.11 source bucket을 사건 correlation으로 연결한다.

## 3. 비범위

- 계정 자동 정지·권한 자동 회수
- IP·User-Agent 저장 또는 자동 차단
- 외부 이메일·Slack·SIEM 전송
- telemetry만으로 사용자 제재 생성
- 일반 사용자 알림함에 보안 사건 노출
- ML 기반 이상 탐지

## 4. 데이터 모델

### 4.1 `public.admin_security_incidents`

사건의 현재 상태를 보관한다.

- `id UUID`
- `fingerprint TEXT`
- `status`: `open`, `acknowledged`, `resolved`, `false_positive`
- `severity`: `medium`, `high`, `critical`
- `actor_id UUID`
- `event_kind`, `action_key`, `resource_key`, `failure_code`, `route_key`, `subject_type`
- `first_bucket_id`, `latest_bucket_id`
- `first_detected_at`, `last_detected_at`
- `occurrence_count_snapshot`
- `assigned_to UUID NULL`
- `acknowledged_at`, `acknowledged_by`
- `resolved_at`, `resolved_by`
- `resolution_code NULL`
- `alerted_at NULL`
- `alert_cooldown_until NULL`
- `created_at`, `updated_at`

활성 사건은 `status IN ('open','acknowledged')`다. 동일 fingerprint의 활성 사건은 하나만 허용한다.

### 4.2 `public.admin_security_incident_events`

사건 상태 변경 append-only 원장이다.

- `id BIGINT`
- `incident_id UUID`
- `event_type`: `created`, `signal_updated`, `alerted`, `acknowledged`, `assigned`, `resolved`, `reopened`
- `actor_id UUID NULL`
- `previous_status`, `new_status`
- `previous_assignee_id`, `new_assignee_id`
- `reason_code NULL`
- `note NULL`
- `source_bucket_id BIGINT NULL`
- `created_at`

`note`는 최대 2,000자이며 목록에는 노출하지 않는다. 상세 화면에서 최고 관리자에게만 제공한다.

## 5. 사건 fingerprint

다음 고정 필드를 `|`로 결합하고 SHA-256 hex로 저장한다.

- actor UUID
- event kind
- action key
- resource key
- failure code
- route key
- subject type

대상 ref는 P1-2.11에서 표본이므로 fingerprint에 포함하지 않는다.

## 6. 탐지 기준

P1-2.11의 기존 위험도 분류를 기반으로 한다.

### critical

- `event_overflow / distinct_bucket_limit`
- 동일 actor의 `permission_denied` 20회 이상
- 동일 actor의 `suspicious_query` 20회 이상

### high

- P1-2.11 risk `high`
- `permission_denied` 10회 이상
- `suspicious_query` 10회 이상
- `command_failed` 20회 이상

### medium

- `permission_denied`, `conflict`, `command_failed` 5회 이상
- 기타 telemetry 10회 이상

기준 미달 신호는 사건을 만들지 않는다.

## 7. 자동 사건 평가

`private.evaluate_admin_security_incident(p_bucket_id)`를 추가한다.

- source bucket을 row lock으로 읽는다.
- threshold를 계산한다.
- 기준 미달이면 종료한다.
- fingerprint advisory lock을 획득한다.
- 동일 fingerprint 활성 사건이 있으면 latest bucket, last detected, count snapshot, severity를 갱신한다.
- 없으면 사건을 생성하고 `created` 이벤트를 기록한다.
- 갱신된 severity가 이전보다 상승하면 이벤트를 기록한다.
- cooldown이 끝났으면 `alerted` 이벤트를 기록하고 `alerted_at`, `alert_cooldown_until`을 갱신한다.

`private.record_admin_security_event()`의 upsert 직후 평가 함수를 호출한다. telemetry 기록 실패나 사건 평가 실패가 원래 운영 요청을 가리지 않도록 public reporter 계약은 그대로 best-effort다.

## 8. 알림 cooldown

- medium: 24시간
- high: 6시간
- critical: 1시간

알림은 별도 일반 사용자 notification row가 아니라 사건 원장의 `alerted` 이벤트와 `/admin` 미처리 badge로 표현한다.

이유:

- 기존 `notifications`는 일반 사용자 이벤트 allowlist와 target 제약을 가진다.
- 보안 사건은 super-admin 전용이며 일반 알림함과 분리해야 한다.
- 외부 채널 전송은 비범위다.

## 9. 상태 전이

허용 전이:

- `open -> acknowledged`
- `open -> resolved`
- `open -> false_positive`
- `acknowledged -> resolved`
- `acknowledged -> false_positive`
- `resolved -> open`
- `false_positive -> open`

규칙:

- acknowledge 시 `acknowledged_by/at` 기록
- assignee는 super-admin만 지정·해제
- resolve/false positive에는 reason code 필수
- reopen에는 reason code 필수
- 같은 상태로의 무의미한 전이 금지
- optimistic concurrency용 `p_expected_updated_at` 필수

## 10. 권한

신규 capability:

- `security_incident_view`: super_admin
- `security_incident_manage`: super_admin

DB RPC 내부에서 매번 재검사한다.

- list/count/detail: `security_incident_view`
- acknowledge/assign/resolve/reopen: `security_incident_manage`

원본 테이블·sequence·private 함수는 anon/authenticated 직접 접근을 차단한다.

## 11. 조회 RPC

### `public.list_admin_security_incidents(...)`

필터:

- status allowlist
- severity allowlist
- actor UUID
- assignee UUID
- exact fingerprint
- `[from,to)`
- `(last_detected_at DESC, id DESC)` keyset
- limit 1~100

### `public.get_admin_security_incident_detail(UUID)`

반환:

- incident current state
- source bucket 최초·최근 표본
- incident events 최신 100건
- same fingerprint 최근 source buckets 최대 50건
- P1-2.10 audit correlation ID

### `public.get_admin_security_incident_summary()`

- open count
- acknowledged count
- high/critical active count
- unassigned active count
- newest active timestamp

## 12. Mutation RPC

- `public.acknowledge_admin_security_incident(...)`
- `public.assign_admin_security_incident(...)`
- `public.resolve_admin_security_incident(...)`
- `public.reopen_admin_security_incident(...)`

모든 mutation은 current row를 `FOR UPDATE`하고 expected timestamp를 검증한다. 충돌은 `40001`로 통일한다.

## 13. P1-2.10 감사 연결

감사 event kind에 `security_incident_event`를 추가한다.

- event ID: incident event BIGINT
- correlation: `security-incident:<incident_id>`
- group: 동일 값
- actor: incident event actor
- subject: incident actor UUID
- action: incident event type
- reason code: incident event reason code
- summary: 상태·담당자 변경의 고정 문구
- source href: `/admin/security-incidents/<incident_id>`

목록에는 note를 포함하지 않는다. 상세 RPC의 sensitive evidence에만 note를 포함한다.

## 14. 애플리케이션

### `/admin/security-incidents`

- summary cards
- status/severity/actor/assignee/date 필터
- active incident 우선 탐색
- keyset next page
- telemetry 신뢰 수준 표시

### `/admin/security-incidents/[incidentId]`

- current state
- source signal 정보
- 담당자 지정
- acknowledge/resolve/false-positive/reopen form
- incident event timeline
- P1-2.10 audit correlation 링크
- P1-2.11 source telemetry 링크

### `/admin`

- 보안 사건 카드에 active/high count badge

## 15. 유지보수

- resolved/false_positive 사건은 최소 1년 보존
- incident event 원장은 사건과 함께 1년 보존 후 정리 가능
- 이번 단계에서는 삭제 job을 추가하지 않는다. 실제 사건량을 관찰한 뒤 별도 retention 단계에서 도입한다.

## 16. 검증

- threshold boundary별 incident 생성 여부
- 동일 fingerprint active 사건 dedupe
- severity escalation
- cooldown별 alerted event 제한
- active 사건 종료 후 동일 신호 재발 시 신규 incident 생성
- 상태 전이 및 optimistic concurrency
- role/capability matrix
- list keyset no overlap
- detail note 권한
- audit stream correlation
- source bucket linkage
- dashboard count consistency
- table/private function privilege matrix
- Hosted fixture rollback
- exact-head lint/build
- PR 생성 후 사용자 승인 전 병합 금지
