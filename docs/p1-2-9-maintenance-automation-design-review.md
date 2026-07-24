# P1-2.9 운영 유지보수 잡·보존정책 자동화 설계 리뷰

## 리뷰 결론

`pg_cron`이 private bounded runner를 호출하고 service-role RPC가 같은 batch helper를 재사용하는 구조는 타당하다. 다만 실패 원장을 같은 transaction에서 보존하는 방식, Cron 세션 권한 판정, 기존 public RPC 호환성, Cron 자체 실행 이력 증가, 신고 상세 비식별화의 감사 보존 경계를 명시적으로 보완해야 한다.

## 발견 사항과 보완

### 1. 실패 시 원장도 rollback되는 문제

**문제**

runner가 오류를 기록한 뒤 예외를 다시 발생시키면 유지보수 변경과 함께 실패 원장도 rollback된다.

**보완**

- 실제 작업 loop를 PL/pgSQL nested `BEGIN ... EXCEPTION` block으로 감싼다.
- 오류가 발생하면 nested subtransaction의 데이터 변경만 rollback한다.
- outer block에서 `failed` 실행 행을 INSERT한다.
- 오류를 재전파하지 않고 JSON 결과를 반환한다.
- Cron infrastructure 오류는 별도로 `cron.job_run_details`에서 확인한다.

### 2. SECURITY DEFINER에서 `current_user`를 신뢰할 수 없음

**문제**

SECURITY DEFINER 함수의 `current_user`는 항상 함수 소유자이므로 API 호출과 Cron 호출을 구분할 수 없다.

**보완**

- Cron 허용 여부는 `session_user = 'postgres'`로 판정한다.
- API 호출은 `auth.role() = 'service_role'`로 판정한다.
- `current_user = 'postgres'`만으로 허용하지 않는다.
- public wrapper는 service-role만 실행 가능하고 private runner는 API 역할에서 EXECUTE 권한을 회수한다.

### 3. Cron과 기존 service-role RPC의 권한 충돌

**문제**

기존 정리 RPC는 `auth.role()`이 service-role인지 검사한다. Cron은 JWT context가 없어 직접 호출할 수 없다.

**보완**

- 데이터 변경은 private batch helper로 분리한다.
- 기존 public RPC는 동일 signature와 result type을 유지한 채 service-role 검사 후 helper를 호출한다.
- Cron은 public RPC가 아니라 private runner를 호출한다.

### 4. 기존 RPC의 무제한 처리 계약

**문제**

알림 정리 RPC는 현재 조건에 맞는 모든 행을 한 DELETE로 처리한다. 대규모 데이터에서는 잠금과 WAL 증가 위험이 있다.

**보완**

- 기존 signature는 유지한다.
- 내부적으로 bounded batch를 반복하되 전체 최대 처리량을 제한한다.
- Cron 정의의 batch와 max-batches를 authoritative 운영 한도로 둔다.
- 남은 행은 다음 schedule에서 처리한다.

### 5. 작업 실패 후 부분 반영

**문제**

batch마다 commit할 수 없는 단일 함수 transaction에서 중간 batch 뒤 오류가 발생하면 처리 건수와 실제 반영량이 불일치할 수 있다.

**보완**

- runner 전체 데이터 변경 loop를 하나의 nested subtransaction으로 실행한다.
- 성공 시에만 모든 batch 변경이 commit된다.
- 실패하면 해당 실행의 변경은 전부 rollback되고 affected rows는 0으로 기록한다.

### 6. 중복 실행 기록

**문제**

중복 호출을 조용히 반환하면 운영자가 작업이 실제 실행되지 않았다는 사실을 알 수 없다.

**보완**

- `pg_try_advisory_xact_lock` 실패 시 `skipped_locked` 실행 행을 기록한다.
- lock key는 `maintenance-job:<job_key>`를 stable hash로 변환한다.
- 다른 job key는 서로 막지 않는다.

### 7. Cron 로그 자체의 무한 증가

**문제**

자체 실행 원장을 추가해도 `cron.job_run_details`가 별도로 계속 증가한다.

**보완**

- `prune_cron_history` 작업을 추가한다.
- 30일이 지난 Cron 실행 세부 기록을 bounded batch로 삭제한다.
- 매일 03:50 UTC에 실행한다.
- 사용자 유지보수 원장은 삭제하지 않는다.

### 8. 신고 원장 삭제 위험

**문제**

신고 데이터 보존정책을 행 삭제로 구현하면 신고자, 결정, 제재 근거의 traceability가 깨질 수 있다.

**보완**

- `comment_reports`와 `comment_report_decisions` 행은 삭제하지 않는다.
- 해결 또는 기각 후 180일이 지난 `details` 자유서술만 `NULL`로 비식별화한다.
- `details_redacted_at`을 기록한다.
- reason, status, decision link, timestamp는 유지한다.

### 9. 차단 댓글 redaction과 `updated_at`

**문제**

댓글 UPDATE trigger가 redaction 시각에 `updated_at`을 갱신한다. 후보 조건이 `updated_at`만 보면 다시 처리되거나 보존 기준이 흔들릴 수 있다.

**보완**

- 기존 `body_redacted_at IS NULL` 조건을 필수로 유지한다.
- redaction 후에는 `updated_at`과 무관하게 재처리되지 않는다.
- 사용자에게 공개되는 본문은 고정 placeholder로 교체한다.

### 10. Cron Job 중복 등록

**문제**

migration 재실행 또는 schedule 변경 시 같은 목적의 Job이 여러 개 남을 수 있다.

**보완**

- 고정 job name을 사용한다.
- 등록 전 동일 이름의 모든 job id를 `cron.unschedule(jobid)`로 제거한다.
- 이후 schedule을 한 번만 등록한다.
- 상태 RPC가 definition과 실제 `cron.job` 존재를 비교한다.

### 11. disabled 작업과 Cron schedule 불일치

**문제**

definition이 disabled로 바뀌어도 Cron Job은 계속 호출될 수 있다.

**보완**

- runner가 enabled 여부를 최종 검사한다.
- disabled 작업은 데이터를 변경하지 않고 `disabled` 상태를 기록한다.
- 이번 단계에서는 definition 변경도 migration으로만 수행한다.

### 12. 관리자의 수동 실행 권한

**문제**

브라우저 관리자에게 retention job 실행 권한을 주면 대량 삭제 작업이 일반 운영 권한으로 확장된다.

**보완**

- 관리자 화면은 조회 전용이다.
- 수동 실행은 service-role 전용 RPC만 제공한다.
- 실패한 작업은 다음 Cron 주기에서 자동 재시도된다.
- 긴급 수동 실행은 서버 운영 도구에서 service-role로 수행한다.

### 13. schedule 집중과 동시성

**문제**

여러 대량 작업이 같은 분에 시작되면 I/O와 lock 경합이 커질 수 있다.

**보완**

- 일별 작업을 10분 간격으로 분산한다.
- 제재 만료 작업은 batch가 작고 15분 간격으로 실행한다.
- 각 작업은 statement timeout과 최대 batch 횟수를 가진다.

### 14. 오류 메시지의 개인정보 노출

**문제**

SQL 오류 전체를 원장과 관리자 화면에 저장하면 사용자 입력 원문이 포함될 수 있다.

**보완**

- SQLSTATE와 최대 1,000자의 오류 메시지만 저장한다.
- runner details에는 작업 key, batch 설정, 처리 건수만 저장한다.
- 입력 행의 body, report details, notification value는 저장하지 않는다.

## 최종 구현 조건

1. nested exception block으로 실패 원장 보존
2. `session_user`와 `auth.role()`을 구분한 호출자 검사
3. 기존 service-role RPC signature 유지
4. bounded batch와 최대 반복 횟수
5. 동일 job advisory try-lock
6. `skipped_locked` 관측 가능성
7. Cron 실행 이력 30일 정리 작업 추가
8. 신고 행 보존과 자유서술 detail만 비식별화
9. 고정 job name의 idempotent schedule 등록
10. definition enabled 최종 검사
11. 관리자 화면 조회 전용
12. API 역할의 private runner·원장 직접 접근 차단
13. schedule 분산과 statement timeout
14. 민감 데이터 없는 오류 원장
