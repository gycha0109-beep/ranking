# P1-2.10 운영 상태 감시·장애 알림 설계 리뷰

## 리뷰 결론

유지보수 실행 원장을 source of truth로 삼고 incident projection, append-only event, alert outbox를 분리하는 구조는 타당하다. 다만 감시 자체의 self-monitoring, 초기 배포 직후 stale 오탐, observed event 무한 증가, outbox claim 경쟁, 복구 판정 안정성, 실제 외부 이메일 secret 부재를 명시적으로 보완해야 한다.

## 발견 사항과 보완

### 1. 감시 작업 자체를 감시하면 재귀 장애가 생김

`operations_watchdog`을 일반 maintenance definition에 포함한 뒤 같은 evaluator가 stale 여부를 검사하면 자기 실행 트랜잭션 중 마지막 실행이 아직 없어서 사건을 만들 수 있다.

**보완**

- 감시 Cron은 maintenance job definition이 아니라 별도 고정 Cron으로 등록한다.
- 감시 실행 이력은 `operation_monitor_runs`에 별도 기록한다.
- 이번 단계에서는 watchdog 자체 stale 알림은 비범위로 둔다.

### 2. 초기 배포 직후 stale 오탐

일별 작업이 아직 첫 schedule을 지나지 않았는데 실행 기록이 없다는 이유로 stale 사건을 열 수 있다.

**보완**

- 정책에 `monitoring_started_at`을 기록한다.
- 마지막 실행이 없을 때는 `monitoring_started_at + stale_after`가 지난 경우에만 stale로 판정한다.

### 3. observed event 무한 증가

10분마다 열린 사건에 observed를 남기면 event 원장이 불필요하게 커진다.

**보완**

- 상태 fingerprint가 변경됐거나 마지막 observed 후 6시간이 지난 경우에만 observed event를 기록한다.
- 사건 행의 `last_detected_at`과 `occurrence_count`는 매 평가마다 갱신한다.
- opened/resolved에만 outbox를 생성한다.

### 4. 복구 flap

한 번의 정상 실행만으로 연속 실패 사건을 닫으면 실패와 성공이 교차하는 작업에서 사건이 반복 개폐될 수 있다.

**보완**

- `consecutive_failure`는 최근 실행이 정상이고 최근 2개 중 failed가 0일 때 해결한다.
- Cron registration과 stale은 현재 상태가 false이면 즉시 해결한다.
- lock skip과 backlog는 해당 window/run threshold가 더 이상 충족되지 않을 때 해결한다.

### 5. severity 계약

모든 사건을 동일 severity로 처리하면 운영 우선순위가 불명확하다.

**보완**

- `critical`: cron_unavailable, execution_stale, consecutive_failure
- `warning`: repeated_lock_skip, persistent_backlog
- 전체 상태는 critical 존재 시 장애, warning만 존재 시 주의, 없으면 정상이다.

### 6. outbox claim 경쟁

복수 Edge Function 인스턴스가 같은 pending 항목을 가져갈 수 있다.

**보완**

- claim RPC는 `FOR UPDATE SKIP LOCKED`를 사용한다.
- claim 시 status를 별도 `processing`으로 변경하고 claimed_at을 기록한다.
- 15분 이상 processing인 항목은 재claim 가능하다.
- 상태 enum에 `processing`을 포함한다.

### 7. 실패 재시도 폭주

외부 이메일 provider 장애 시 매 호출마다 즉시 재시도할 수 있다.

**보완**

- `available_at`을 사용한다.
- 실패 후 `2^attempt_count`분, 최대 60분 backoff를 적용한다.
- 5회 실패 후 `dead_letter`로 전환한다.

### 8. 실패 원문 노출

외부 provider의 응답 전체를 저장하면 개인 정보나 provider 내부 정보가 포함될 수 있다.

**보완**

- 오류 코드는 최대 100자, 메시지는 최대 500자로 제한한다.
- 관리자 화면에는 오류 코드와 축약 메시지만 표시한다.

### 9. 수신자 관리

DB에 이메일 주소를 저장하면 별도 개인정보 보존정책이 필요하다.

**보완**

- DB에는 `recipient_key = operations_primary`만 저장한다.
- 실제 이메일 주소는 Edge Function secret에서 해석한다.

### 10. 외부 발송 검증 경계

현재 Hosted connector로 이메일 provider secret을 구성하거나 Edge Function을 배포할 수 없다.

**보완**

- Hosted gate는 incident/outbox 생성, claim, complete/fail 계약까지 검증한다.
- 실제 이메일 발송은 `OPERATIONS_ALERT_EMAIL`과 provider key가 구성된 배포 환경에서 별도 operational verification 대상으로 남긴다.
- 실행하지 않은 외부 발송은 PASS로 선언하지 않는다.

### 11. 관리자 RPC의 민감 정보

outbox payload 전체를 반환하면 향후 민감 필드가 추가될 때 노출 범위가 커진다.

**보완**

- 관리자 RPC는 subject, status, attempt count, timestamps, 축약 오류만 반환한다.
- raw payload는 반환하지 않는다.

### 12. 사건 projection 직접 변경

브라우저뿐 아니라 일반 service code가 projection을 임의 수정하면 event와 불일치한다.

**보완**

- incident writer는 private evaluator 전용 helper로 한정한다.
- table direct mutation 권한은 service_role에도 부여하지 않는다.
- 필요한 변경은 SECURITY DEFINER RPC만 통과한다.

## 최종 구현 조건

1. watchdog은 별도 monitor run 원장을 사용
2. `monitoring_started_at` 기반 초기 stale grace
3. observed event 6시간/fingerprint 변화 제한
4. 사건 유형별 안정적인 resolve 조건
5. critical/warning severity 분리
6. SKIP LOCKED claim과 processing timeout
7. bounded retry 및 dead-letter
8. 오류 메시지 축약
9. recipient key만 DB 저장
10. 외부 이메일 발송 미검증 상태 명시
11. 관리자 RPC에서 raw payload 비노출
12. incident/outbox 직접 mutation 차단
