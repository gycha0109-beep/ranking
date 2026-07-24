# P1-2.10 운영 상태 감시·장애 알림 설계 리뷰

## 리뷰 결론

DB scanner가 장애 판정과 outbox 생성을 담당하고 Edge Function이 이메일 전달만 담당하는 구조는 타당하다. 감시 자체가 외부 이메일 공급자에 종속되지 않으며, 기존 P1-2.9 유지보수 원장을 그대로 관측 데이터로 재사용할 수 있다. 다만 배포 직후 오탐, 일별 작업의 시간 계산, 사건 flapping, 비동기 HTTP 중복 전달, 공개 Edge Function 인증, 공급자 secret 미설정 상태를 명시적으로 보완해야 한다.

## 발견 사항과 보완

### 1. 배포 직후 실행 지연 오탐

**문제**

일별 작업은 다음 실행까지 최대 하루를 기다려야 한다. 정책을 추가하자마자 최근 실행이 없다는 이유로 장애가 발생할 수 있다.

**보완**

- 정책에 `monitor_after`를 둔다.
- 초기값은 migration 적용 시각에서 일별 작업 26시간, 15분 작업 40분 이후다.
- Hosted 검증에서는 fixture 정책의 `monitor_after`만 과거로 조정한다.

### 2. Cron 표현식 직접 해석 위험

**문제**

PostgreSQL에서 모든 Cron 표현식을 일반화해 다음 실행 시각으로 변환하면 구현 복잡도와 오류 가능성이 높다.

**보완**

- 이번 단계에서는 `expected_interval_minutes`와 `stale_after_minutes`를 정책에 명시한다.
- schedule 문자열은 구성 일치 여부만 비교한다.
- 임의 Cron parser는 구현하지 않는다.

### 3. 일별 작업 false positive

**문제**

일별 작업이 몇 분 늦게 실행되거나 scanner와 실행 순서가 바뀌면 장애가 반복될 수 있다.

**보완**

- 일별 stale 기준을 1,560분으로 둔다.
- 사건 해결은 2회 연속 정상 scan 후 수행한다.
- 마지막 실행의 `finished_at`을 기준으로 판정한다.

### 4. 연속 실패 계산

**문제**

단순히 최근 N개 실행 중 실패 수를 세면 실패 사이의 성공을 무시해 잘못된 장애를 만들 수 있다.

**보완**

- 최신 실행부터 역순으로 읽는다.
- `failed`가 이어지는 동안만 세고 `succeeded` 또는 `no_work`에서 중단한다.
- `skipped_locked`와 `disabled`는 연속 실패 계산에서는 건너뛴다.

### 5. 포화 판정의 단발성 backlog

**문제**

한 번 max batch를 처리한 정상 실행까지 장애로 보면 운영 소음이 과도하다.

**보완**

- 최근 3회의 유효 실행이 모두 `batch_count = max_batches`일 때만 사건을 연다.
- 실패와 lock skip은 포화 연속 횟수를 끊는다.
- affected rows가 0인 실행은 포화로 보지 않는다.

### 6. lock contention 시간 범위

**문제**

누적 `skipped_locked` 전체를 세면 이미 해결된 과거 경합이 계속 장애를 유지한다.

**보완**

- 정책별 `lock_window_minutes` 안의 발생만 센다.
- 15분 작업은 30분, 일별 작업은 60분을 사용한다.

### 7. 사건 flapping

**문제**

한 번 정상으로 보였다는 이유로 즉시 해결하면 다음 scan에서 재발 사건과 이메일이 반복될 수 있다.

**보완**

- 열린 사건에 `healthy_scan_count`를 유지한다.
- 조건이 사라진 scan에서 1 증가한다.
- 2회 연속 정상일 때 해결한다.
- 조건이 다시 나타나면 0으로 초기화한다.

### 8. 해결 사건 재발 처리

**문제**

동일 사건 행을 다시 open으로 바꾸면 과거 장애 구간과 재발 구간을 구분할 수 없다.

**보완**

- 해결 사건은 다시 열지 않는다.
- 열린 사건에만 partial unique index를 적용한다.
- 재발 시 새로운 incident row를 생성한다.

### 9. 비동기 HTTP 요청 중복

**문제**

`pg_net` 요청이 지연된 상태에서 scanner가 재시도하면 동일 이메일이 중복 발송될 수 있다.

**보완**

- claim RPC가 delivery row를 `FOR UPDATE`하고 `processing`으로 원자 전환한다.
- 첫 claim 직후 token hash를 제거한다.
- 늦게 도착한 두 번째 요청은 token 검증에 실패한다.
- Resend 호출에도 delivery ID 기반 idempotency key를 사용한다.

### 10. 공개 Edge Function 공격 표면

**문제**

Cron이 JWT를 안전하게 보유하지 않으므로 `verify_jwt=false`가 필요하지만, 인증 없는 함수가 service-role RPC를 대신 호출하는 경로가 될 수 있다.

**보완**

- 요청 body는 delivery ID와 random token만 받는다.
- payload, incident, recipient는 claim RPC 성공 후에만 반환한다.
- token은 32-byte random, 10분 만료, DB에는 hash만 저장한다.
- claim 성공과 동시에 token을 폐기한다.
- 임의 delivery ID 조회와 오류 상세 반환을 금지한다.

### 11. Edge Function SSRF 또는 임의 발송

**문제**

요청 body가 제목·본문·수신자를 직접 지정할 수 있으면 공격자가 임의 이메일 relay로 사용할 수 있다.

**보완**

- 요청 body의 제목, 본문, 수신자 필드를 무시한다.
- 모든 메일 내용과 recipient는 claim RPC 결과만 사용한다.
- recipient는 현재 super_admin 이메일로 제한한다.

### 12. 공급자 secret 미설정

**문제**

현재 프로젝트에는 이메일 공급자 secret이 제공되지 않았다. 이 상태에서 scanner 전체를 실패시키면 장애 감지가 중단된다.

**보완**

- 사건과 delivery 생성은 정상 수행한다.
- Edge Function이 `RESEND_API_KEY` 또는 `OPERATIONS_ALERT_FROM` 부재를 `provider_not_configured`로 완료 RPC에 기록한다.
- 최대 재시도 후 `failed`로 남긴다.
- Hosted 검증은 `hosted_validation` mode로 외부 공급자 없이 전체 claim·complete 경로를 검증한다.
- live 이메일 전달은 secret 설정 후 별도 smoke test가 필요하다.

### 13. 수신자 없음

**문제**

super_admin 역할은 존재해도 auth email이 없거나 비정상일 수 있다.

**보완**

- claim RPC가 유효한 이메일만 반환한다.
- 수신자 배열이 비어 있으면 `recipient_not_configured`로 기록한다.
- 이메일 주소는 사건 원장, 관리자 화면, 통합 감사에 저장하지 않는다.

### 14. 공급자 응답 민감정보

**문제**

Resend 응답 원문이나 요청 body 전체를 저장하면 이메일 주소와 공급자 정보가 노출될 수 있다.

**보완**

- 성공 시 provider message ID만 저장한다.
- 실패 시 코드와 최대 1,000자의 정규화된 메시지만 저장한다.
- response body 전체를 DB에 저장하지 않는다.

### 15. scanner 장애 자체 감시

**문제**

scanner가 실패하면 유지보수 장애를 감지하지 못하지만, 자기 자신에 대한 사건을 같은 scanner가 만들 수 없다.

**보완**

- `operations_monitor_runs`에 scanner 성공·실패를 기록한다.
- 관리자 화면에서 마지막 scanner 성공 시각과 Cron 활성 여부를 별도 표시한다.
- 자기 감시 이메일은 이번 단계 비범위로 두고 향후 외부 heartbeat에서 보완한다.

### 16. scanner transaction 범위

**문제**

장애 원장 갱신 도중 오류가 발생했는데 일부 사건만 반영되면 상태가 불일치할 수 있다.

**보완**

- 상태 판정과 사건·delivery 변경을 하나의 nested transaction block으로 수행한다.
- 오류 시 해당 scan의 상태 변경을 rollback하고 실패 monitor run만 outer block에서 기록한다.
- HTTP dispatch는 상태 변경 성공 후 예약한다.

### 17. 관리자 화면 권한

**문제**

테이블 RLS만 믿고 status RPC 내부 capability 검증이 없으면 authenticated 사용자가 SECURITY DEFINER 결과를 볼 수 있다.

**보완**

- 모든 조회 RPC 시작에서 `private.assert_admin_capability('audit_view')`를 호출한다.
- 테이블 직접 SELECT는 authenticated에 부여하지 않는다.
- middleware도 `/admin/operations`에 `audit_view`를 요구한다.

### 18. 감사 원장 과다 노출

**문제**

통합 감사에 evidence와 이메일 오류 전체를 포함하면 운영 내부 구조와 주소가 넓게 노출된다.

**보완**

- 통합 감사에는 incident type, severity, occurrence count만 포함한다.
- 상세 evidence와 delivery error는 `/admin/operations` 전용 RPC에서만 제공한다.

## 최종 구현 조건

1. 명시적 주기·stale 정책과 배포 유예
2. 연속 실패·연속 포화의 올바른 계산
3. 시간 범위가 있는 lock contention
4. 2회 정상 확인 후 해결
5. 해결 사건 재사용 금지
6. incident 발생·복구 delivery dedupe
7. 32-byte 일회용 token hash 인증
8. atomic claim과 token 즉시 폐기
9. provider idempotency key
10. provider secret 부재가 scanner를 막지 않음
11. super_admin 이메일만 수신
12. scanner 실패 원장 보존
13. 조회 RPC의 audit capability 검증
14. 관리자 화면과 통합 감사의 최소 정보 노출
15. live 이메일 secret은 외부 운영 prerequisite로 명시
