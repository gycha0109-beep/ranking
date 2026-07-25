# P1-2.12 운영 보안 사건 대응·알림 구현 리뷰

## 리뷰 결론

설계의 사건 current state, source linkage, append-only workflow 원장, rolling threshold 및 super-admin 전용 대응 방향은 구현 가능하다. 초기 구현 초안에는 사건 누적 횟수, workflow 원장 증폭, 감사 이벤트 권한 경계와 역사적 snapshot에 중대한 보완이 필요했다.

## 발견 사항과 보완

### 1. 신규 사건 누적 횟수 누락

초기 초안은 사건이 생성된 현재 bucket의 count만 lifetime에 반영해, threshold를 만든 이전 55분 bucket 발생량이 사라졌다.

- 신규 사건 `lifetime_occurrence_count`는 rolling 60분 합계로 시작한다.
- 생성 시 같은 fingerprint의 rolling window bucket을 source linkage에 함께 연결한다.
- 이후 동일 bucket 재관측은 linkage의 `last_observed_count`와 현재 count 차이만 누적한다.

### 2. `signal_updated` 원장 폭증

동일 5분 bucket의 occurrence가 1 증가할 때마다 append-only event를 만들면 P1-2.11 집계의 의미가 사라진다.

- current incident의 count와 last detected는 매 관측 갱신한다.
- `signal_updated` event는 신규 source bucket 연결 또는 latest subject 표본 변경 시에만 기록한다.
- severity 상승과 cooldown alert는 각각 별도 event로 기록한다.

### 3. 감사 event의 mutable summary

초기 감사 stream은 incident current row의 현재 severity와 rolling count를 사용해 과거 event 설명이 나중에 달라질 수 있었다.

- incident event 원장에 `window_occurrence_count`, `lifetime_occurrence_count` snapshot을 필수 저장한다.
- created/signal/escalation/alert/workflow mutation 모두 snapshot을 기록한다.
- P1-2.10 audit summary와 evidence는 event snapshot을 우선 사용한다.

### 4. incident audit의 권한 누출

기존 `audit_view`는 admin에게도 부여된다. incident event를 일반 감사 stream에 무조건 합치면 super-admin 전용 사건 정보가 admin에게 노출된다.

- incident audit branch는 `security_incident_view`를 DB에서 추가 확인한다.
- 전체 audit 조회에서는 권한 없는 역할에게 incident branch를 제외한다.
- incident kind를 명시 요청하면 SQLSTATE `42501`로 거부한다.
- incident audit detail도 `security_incident_view`를 요구한다.
- UI의 incident audit kind 필터는 해당 capability 보유자에게만 표시한다.

### 5. rolling query index

기존 bucket unique index는 bucket timestamp가 선두라 fingerprint별 60분 합계에 최적화되지 않았다.

- actor, event/action/resource/failure/route/subject, bucket timestamp 순서의 전용 rolling-window index를 추가한다.

### 6. optimistic concurrency와 자동 신호 갱신

- 자동 count, severity, alert 갱신은 `workflow_version`을 변경하지 않는다.
- acknowledge/assign/resolve/reopen만 version을 증가시킨다.
- 운영 form이 telemetry 유입 때문에 불필요하게 충돌하지 않는다.

### 7. 감사 액션 중복 상수

기존 audit server action은 `admin-access.ts` 내부의 별도 event kind 상수를 사용한다.

- pure contract는 `src/lib/admin-audit.ts`에 둔다.
- 신규 `src/lib/actions/admin-audit.ts`가 shared contract를 사용한다.
- audit 목록·상세 화면을 신규 action으로 전환한다.
- 기존 호환 export는 유지해 다른 운영 기능을 깨지 않는다.

### 8. Middleware capability

신규 경로가 generic `content_manage`로 분류되면 권한 의도가 불명확하다. P1-2.11 security event 경로도 같은 문제가 있었다.

- `/admin/security-events`는 `security_event_view`
- `/admin/security-incidents`는 `security_incident_view`
- DB RPC capability 재검사는 그대로 유지한다.

### 9. TypeScript 초안 오류

incident list RPC args에 `p_to`가 중복 선언되어 production build 실패 가능성이 있었다.

- 중복 속성을 제거했다.
- pure type과 server action을 분리해 `use server` export 제약을 지켰다.
- workflow event count snapshot parser와 UI 표시를 추가했다.

## 구현 후 필수 검증

1. 분산된 5분 bucket이 rolling 60분 threshold를 만든다.
2. 신규 incident lifetime은 rolling 합계와 일치한다.
3. 같은 bucket count 증가가 workflow 원장을 매번 늘리지 않는다.
4. 신규 bucket, severity escalation, cooldown alert만 의도대로 event를 만든다.
5. incident event snapshot은 current row 변경 후에도 유지된다.
6. admin은 incident audit event를 볼 수 없고 super-admin만 볼 수 있다.
7. workflow version은 자동 신호 갱신에서 불변이다.
8. keyset, 상태 전이, assignee 검증, source prune 생존성을 Hosted에서 확인한다.
9. exact-head lint/build가 성공해야 한다.
