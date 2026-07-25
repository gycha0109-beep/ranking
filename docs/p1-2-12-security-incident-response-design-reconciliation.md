# P1-2.12 설계 리뷰 반영·최종 계약

이 문서는 최초 설계와 설계 리뷰의 차이를 해소하는 구현 기준이다. 충돌 시 이 문서가 우선한다.

## 1. 시스템 성격

- P1-2.11 bucket은 `authenticated_self_report` telemetry다.
- P1-2.12 incident는 telemetry를 운영자가 확인하기 위한 triage workflow다.
- incident는 단독 제재 근거나 침해 확정 증거로 표현하지 않는다.
- 자동 정지·권한 회수·외부 차단은 하지 않는다.

## 2. 최종 current-state 테이블

`public.admin_security_incidents`

- UUID primary key
- active fingerprint partial unique
- status: `open`, `acknowledged`, `resolved`, `false_positive`
- severity: `medium`, `high`, `critical`
- source trust 고정: `authenticated_self_report`
- source fingerprint fields snapshot
- first/latest subject ref snapshot
- nullable first/latest bucket FK `ON DELETE SET NULL`
- rolling 60분 count snapshot
- active incident lifetime count
- workflow version
- assignee/acknowledge/resolve fields
- alert/cooldown fields
- created/updated timestamps

자동 signal update와 alert update는 workflow version을 변경하지 않는다.

## 3. source linkage와 event 원장

### `public.admin_security_incident_sources`

incident별 source bucket 관측값을 추적한다.

- primary key: `(incident_id, bucket_id)`
- bucket FK는 `ON DELETE CASCADE`
- `first_observed_count`, `last_observed_count`
- `linked_at`, `updated_at`

같은 bucket이 재집계될 때 lifetime count에는 `current_count - last_observed_count` delta만 더한다. P1-2.11의 90일 prune으로 bucket이 삭제되면 linkage row만 삭제되며 incident snapshot과 lifetime count는 유지된다.

### `public.admin_security_incident_events`

- BIGINT identity
- incident UUID FK
- event type:
  - `created`
  - `signal_updated`
  - `severity_escalated`
  - `alerted`
  - `acknowledged`
  - `assigned`
  - `resolved`
  - `reopened`
- actor UUID nullable
- previous/new status
- previous/new assignee
- previous/new severity
- reason code
- note 최대 2,000자
- source bucket nullable FK `ON DELETE SET NULL`
- created timestamp

update/delete는 trigger로 거부한다.

## 4. fingerprint

`encode(digest(concat_ws('|', actor_id, event_kind, action_key, resource_key, failure_code, route_key, subject_type), 'sha256'), 'hex')`

대상 ref는 표본이므로 fingerprint에 포함하지 않는다.

## 5. rolling 탐지

현재 bucket과 동일 fingerprint를 가진 최근 60분 bucket의 occurrence count 합계를 사용한다.

- critical
  - overflow signal
  - permission denied >= 20
  - suspicious query >= 20
- high
  - permission denied >= 10
  - suspicious query >= 10
  - command failed >= 20
  - P1-2.11 risk high
- medium
  - permission denied/conflict/command failed >= 5
  - 기타 >= 10

기준 미달이면 incident를 만들거나 갱신하지 않는다.

## 6. incident 자동 평가

`private.evaluate_admin_security_incident(bucket_id)`

1. bucket을 읽고 fingerprint와 rolling count를 계산한다.
2. fingerprint advisory lock을 획득한다.
3. active incident가 없으면 생성한다.
4. 있으면 source linkage delta를 계산하고 latest source, subject snapshot, rolling/lifetime count, last detected를 갱신한다.
5. severity는 상승만 허용한다.
6. 조건에 따라 `signal_updated`, `severity_escalated`를 기록한다.
7. 생성 즉시 `created`, `alerted`를 기록한다.
8. 이후 cooldown 종료 시에만 추가 `alerted`를 기록한다.

`private.record_admin_security_event()`는 bucket upsert 후 별도 exception block에서 evaluator를 호출한다. evaluator 실패는 bucket 기록을 롤백하지 않는다.

## 7. cooldown

- medium: 24시간
- high: 6시간
- critical: 1시간

알림은 incident `alerted` event와 admin dashboard badge로 구현한다. 일반 사용자 `notifications` 테이블은 사용하지 않는다.

## 8. 상태와 mutation

### acknowledge

- open만 허용
- acknowledged 상태로 전환
- 현재 actor를 acknowledged_by로 저장

### assign

- active incident만 허용
- assignee는 NULL 또는 현재 super_admin
- status는 변경하지 않는다

### resolve

- open/acknowledged만 허용
- target status는 resolved 또는 false_positive
- resolution code 필수
- note 선택, 최대 2,000자

### reopen

- resolved/false_positive만 허용
- open으로 전환
- reason code 필수
- acknowledge/resolve 필드를 초기화

모든 mutation은 expected workflow version을 검사한다. 불일치는 SQLSTATE `40001`이다.

## 9. resolution code

- resolved:
  - `mitigated`
  - `expected_behavior`
  - `duplicate`
  - `insufficient_evidence`
  - `other`
- false positive:
  - `test_activity`
  - `operator_error`
  - `telemetry_noise`
  - `expected_behavior`
  - `other`
- reopen:
  - `signal_recurred`
  - `new_evidence`
  - `incorrect_resolution`
  - `other`

## 10. 권한

- `security_incident_view`: super_admin only
- `security_incident_manage`: super_admin only

list/count/detail/assignee candidates는 view capability, mutation은 manage capability를 DB에서 재검사한다.

## 11. 조회

### 목록

- status
- severity
- actor UUID
- assignee UUID
- exact fingerprint
- `[from,to)`
- `(last_detected_at DESC, id DESC)` keyset
- limit 1~100

### 상세

- current incident
- first/latest source bucket, 존재할 때만
- incident source linkage가 남아 있는 최근 buckets 최대 50
- incident events 최대 100
- note 포함
- audit correlation ID

### summary

- open
- acknowledged
- high/critical active
- unassigned active
- newest active timestamp

### assignees

현재 super_admin 역할 사용자만 반환한다.

## 12. P1-2.10 감사 연결

신규 audit kind: `security_incident_event`

- event ID: incident event BIGINT
- correlation/group: `security-incident:<incident_id>`
- actor: incident event actor
- subject: incident의 telemetry actor UUID
- action: incident event type
- reason: reason code
- source href: `/admin/security-incidents/<incident_id>`
- list/related: note 제외
- detail sensitive evidence: note 포함

기존 private stream, public v2 validation, detail, legacy v1 최소 details, TypeScript kind constants를 함께 변경한다.

## 13. 애플리케이션

- `/admin/security-incidents`
  - summary cards
  - filters
  - keyset page
  - trust warning
- `/admin/security-incidents/[incidentId]`
  - current state and source snapshots
  - assignee selection
  - acknowledge/resolve/false-positive/reopen actions
  - event timeline
  - audit and telemetry links
- `/admin`
  - incident card and active/high count badge

## 14. 보안

- table/sequence direct privilege 제거
- private function execute 제거
- current table mutation은 SECURITY DEFINER RPC만 가능
- event ledger update/delete trigger 거부
- note는 incident detail과 audit sensitive detail에만 노출
- source href는 DB UUID로만 구성
- input allowlist/length/UUID/timestamp/cursor 검증

## 15. retention

- P1-2.11 source bucket 90일 정책 유지
- incident snapshot은 source bucket 삭제 후에도 해석 가능
- source linkage는 bucket prune에 따라 제거
- incident와 event는 최소 1년 보존 대상으로 유지
- incident prune job은 이번 범위에서 제외

## 16. 구현·검증 게이트

- rolling window threshold
- source linkage delta와 lifetime count
- active fingerprint dedupe
- severity escalation/no downgrade
- cooldown
- workflow version concurrency
- assignee role validation
- state transition matrix
- closed 후 신규 incident 생성
- bucket delete snapshot survival
- event immutability
- list keyset no overlap
- summary consistency
- audit correlation and note gating
- privilege matrix
- Hosted fixture rollback
- exact-head lint/build
- PR 생성
- 사용자 명시적 승인 전 병합 금지
