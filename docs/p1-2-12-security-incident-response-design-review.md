# P1-2.12 운영 보안 사건 대응·알림 설계 리뷰

## 리뷰 결론

P1-2.11 telemetry를 자동 사건으로 전환하고 상태 변경을 append-only 원장과 P1-2.10 감사 stream에 연결하는 방향은 타당하다. 다만 최초 설계대로 구현하면 5분 버킷 경계마다 반복 신호가 분산되고, source bucket 90일 삭제와 incident FK가 충돌하며, 자동 신호 갱신 때문에 운영자 mutation이 과도하게 충돌할 수 있다.

## 발견 사항과 보완

### 1. 5분 bucket count만으로는 반복 탐지가 누락됨

동일 fingerprint가 매 버킷 2회씩 발생하면 각 버킷은 threshold 미달이지만 1시간 동안 24회가 될 수 있다.

- incident 평가 시 현재 bucket 한 건만 보지 않는다.
- 동일 fingerprint의 최근 60분 bucket `occurrence_count` 합계를 계산한다.
- severity와 생성 threshold는 `window_occurrence_count` 기준으로 계산한다.
- incident에는 `window_occurrence_count`, `lifetime_occurrence_count`를 분리 저장한다.
- `lifetime_occurrence_count`는 active incident가 관측한 신규 bucket delta를 누적한다.

### 2. source bucket FK와 90일 retention 충돌

P1-2.11은 source bucket을 90일 후 삭제한다. 사건이 1년 이상 보존되면 강한 FK `RESTRICT`는 retention을 막는다.

- `first_bucket_id`, `latest_bucket_id`, event `source_bucket_id`는 nullable FK `ON DELETE SET NULL`로 둔다.
- incident current row에 event/action/resource/failure/route/subject와 최초·최근 subject ref snapshot을 보존한다.
- source bucket이 남아 있을 때만 상세에서 원본 telemetry를 추가 조회한다.
- 사건은 source bucket 삭제 후에도 독립적으로 해석 가능해야 한다.

### 3. 자동 incident 평가 실패가 telemetry 기록을 롤백할 위험

`private.record_admin_security_event()` 안에서 평가 함수가 예외를 내면 bucket upsert까지 전체 롤백될 수 있다.

- 평가 호출은 별도 PL/pgSQL exception block으로 감싼다.
- 평가 실패는 telemetry bucket 기록을 취소하지 않는다.
- public reporter의 best-effort 계약도 유지한다.
- Hosted 검증에서 의도적인 평가 실패를 만들지는 않되 함수 구조를 확인한다.

### 4. `updated_at` optimistic concurrency의 과민성

새 telemetry가 도착할 때마다 incident `updated_at`이 변경되면 운영자가 form을 여는 동안 state transition이 계속 `40001`로 실패할 수 있다.

- `workflow_version BIGINT`를 별도로 둔다.
- 자동 signal update, count update, alert timestamp update는 workflow version을 바꾸지 않는다.
- acknowledge/assign/resolve/reopen만 version을 1 증가시킨다.
- mutation RPC는 `p_expected_workflow_version`을 검사한다.

### 5. severity 하락 방지

rolling window count가 감소하면 새 계산 severity가 낮아질 수 있다. 이미 높은 심각도로 대응 중인 사건을 자동으로 낮추면 운영 이력이 왜곡된다.

- active incident severity는 자동 평가에서 상승만 허용한다.
- severity rank는 `medium < high < critical`로 고정한다.
- 상승 시 `severity_escalated` incident event를 기록한다.
- 자동 하향은 하지 않는다.

### 6. incident event 종류 누락

최초 이벤트 allowlist에 severity 상승을 표현할 종류가 없다.

최종 allowlist:

- `created`
- `signal_updated`
- `severity_escalated`
- `alerted`
- `acknowledged`
- `assigned`
- `resolved`
- `reopened`

`signal_updated`는 모든 bucket마다 기록하면 원장이 커질 수 있으므로 다음 경우에만 기록한다.

- 신규 source bucket 연결
- window count가 이전 snapshot보다 증가
- latest subject ref 변경

### 7. alerted event와 사건 생성 관계

사건 생성 즉시 운영 화면에서 발견 가능해야 한다.

- 사건 생성 transaction에서 `created` 다음 `alerted` 이벤트를 기록한다.
- 최초 cooldown도 즉시 설정한다.
- 이후 signal update에서 cooldown이 끝났을 때만 추가 `alerted` 이벤트를 기록한다.

### 8. telemetry 신뢰 수준

인증 사용자가 자신의 telemetry를 직접 self-report할 수 있으므로 incident도 침해 증거로 단정할 수 없다.

- incident에는 `source_trust = authenticated_self_report`를 고정 snapshot으로 저장한다.
- UI에 “운영 triage 신호이며 단독 제재 근거가 아님”을 표시한다.
- 자동 제재·권한 회수는 금지한다.
- false positive 종결 경로를 제공한다.

### 9. assignee 후보 계약

임의 UUID 입력은 운영 실수를 유발한다.

- `public.list_security_incident_assignees()`를 추가한다.
- 현재 `super_admin` 역할 사용자만 반환한다.
- assign RPC도 대상이 현재 super_admin인지 DB에서 재검사한다.
- `NULL` 지정으로 담당 해제를 허용한다.

### 10. 상태 전이와 필드 정합성

- `open`: acknowledged/resolved 필드 모두 null
- `acknowledged`: acknowledged 필드 필수, resolved 필드 null
- `resolved`, `false_positive`: resolved 필드와 resolution code 필수
- reopen 시 acknowledged/resolved/resolution 필드를 초기화한다.
- assignment은 상태와 독립적으로 변경 가능하되 active 사건에서만 허용한다.
- closed 사건 담당 변경은 금지한다.

### 11. resolution code allowlist

자유서술만으로 종결 유형을 만들면 통계와 필터가 불가능하다.

- resolved: `mitigated`, `expected_behavior`, `duplicate`, `insufficient_evidence`, `other`
- false positive: `test_activity`, `operator_error`, `telemetry_noise`, `expected_behavior`, `other`
- reopen: `signal_recurred`, `new_evidence`, `incorrect_resolution`, `other`
- note는 선택이며 최대 2,000자다.

### 12. P1-2.10 audit 확장 범위

기존 stream·v2 allowlist·detail·애플리케이션 상수를 모두 함께 변경해야 한다.

- event kind `security_incident_event`
- event ID는 BIGINT
- correlation/group은 `security-incident:<uuid>`
- list/related에는 note 금지
- detail sensitive evidence에만 note 포함
- source href는 고정 prefix와 authoritative UUID로만 조합

### 13. dynamic source href 안전성

- incident UUID는 DB authoritative 값만 사용한다.
- SQL source href는 `/admin/security-incidents/` + UUID 형식으로만 생성한다.
- 애플리케이션 route segment도 encode한다.

### 14. 사건 목록 정렬

운영 우선순위와 stable cursor를 동시에 만족해야 한다.

- 기본 정렬은 `last_detected_at DESC, id DESC`로 고정한다.
- severity/status 우선 정렬은 cursor 안정성을 복잡하게 하므로 필터와 summary card로 제공한다.
- active 사건만 보는 빠른 필터를 기본 UI에 제공한다.

### 15. 사건 event 원장 immutability

- `admin_security_incident_events` update/delete를 trigger로 거부한다.
- incident current row는 SECURITY DEFINER mutation만 변경한다.
- 두 테이블 모두 직접 권한을 제거한다.

### 16. retention 표현

이번 단계에 삭제 job이 없으므로 “1년 후 삭제”를 약속하면 안 된다.

- 사건과 event는 최소 1년 보존 대상으로 명시한다.
- 실제 prune job은 사건량과 운영 정책이 확정된 후 별도 단계로 둔다.
- P1-2.11 bucket 90일 prune은 그대로 유지한다.

### 17. 검증 보강

Hosted 검증에 다음을 포함한다.

- 여러 5분 bucket에 분산된 rolling 60분 합계
- severity 자동 하락 방지
- signal update 중 workflow version 불변
- source bucket delete 후 incident snapshot 유지
- assignee role validation
- active partial unique 경쟁 조건
- closed 후 신규 신호가 별도 incident 생성
- incident event immutability
- P1-2.10 list/detail note 분리

## 최종 구현 조건

1. rolling 60분 합계 기반 탐지
2. source FK `ON DELETE SET NULL`과 snapshot 보존
3. telemetry upsert와 incident 평가 예외 격리
4. workflow version 기반 optimistic concurrency
5. severity 상승만 허용
6. `severity_escalated` event와 제한된 signal event
7. 생성 즉시 alerted/cooldown 설정
8. triage telemetry 신뢰 수준 표시
9. super-admin assignee 후보 검증
10. 상태별 필드 정합성
11. resolution code allowlist
12. audit stream 전체 계약 동시 확장
13. 안전한 내부 source href
14. stable keyset 정렬
15. event immutability와 direct privilege 제거
16. 사건 최소 1년 보존, prune 비범위
17. 강화된 Hosted 검증
