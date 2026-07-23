# P1-2.6 사용자 알림 시스템 설계 리뷰

## 리뷰 결론

기본 구조는 타당하다. 특히 기존 댓글·Moderation·신고 처리 함수를 다시 복제하지 않고, 이미 존재하는 업무 증거 행을 알림 projection의 입력으로 사용하는 방향이 장기 유지보수에 유리하다.

다만 트리거 기반 구조는 숨은 결합과 개인정보 복제 위험을 만들 수 있으므로 아래 보완 조건을 구현에 강제한다.

## 발견 사항과 보완

### 1. 핵심 함수 반복 재정의 위험

**문제**

알림을 추가하기 위해 `private.create_content_comment`, `private.apply_moderation_review`, `review_comment_report_case` 전체를 다시 정의하면 이후 원본 함수 수정이 알림 migration에서 되돌아갈 수 있다.

**보완**

- 핵심 함수를 덮어쓰지 않는다.
- 답글·Moderation review·신고 decision 테이블의 AFTER INSERT 트리거를 사용한다.
- 트리거 함수는 알림 생성만 담당하며 업무 상태를 수정하지 않는다.

### 2. 트리거의 숨은 부작용

**문제**

트리거는 호출부 코드에서 보이지 않아 운영자가 알림 생성 경로를 추적하기 어렵다.

**보완**

- 트리거 이름에 `notification`과 이벤트 원인을 명시한다.
- 하나의 범용 private enqueue helper와 이벤트별 trigger function을 분리한다.
- migration과 구현 리뷰 문서에 source table → notification type 매핑을 기록한다.

### 3. 알림 생성 실패의 업무 영향

**문제**

알림 insert 오류가 답글·Moderation·신고 처리 전체를 롤백할 수 있다. 반대로 모든 오류를 삼키면 사용자가 결과를 영구적으로 받지 못해도 감지되지 않는다.

**보완**

- 정상적인 재실행은 unique dedupe key와 `ON CONFLICT DO NOTHING`으로 무해하게 처리한다.
- 예상하지 못한 스키마·제약·권한 오류는 삼키지 않고 원본 트랜잭션을 실패시킨다.
- 알림은 업무 결과 계약의 일부로 취급한다.
- 후속 외부 발송 채널이 추가될 때만 별도 outbox/worker를 도입한다.

### 4. 사용자 입력 복제와 개인정보 노출

**문제**

댓글 본문, 신고 상세, 관리자 메모를 알림 payload에 저장하면 원본 redaction 또는 접근 통제가 알림 사본에는 적용되지 않는다.

**보완**

- 자유 형식 payload JSON과 본문 snapshot을 저장하지 않는다.
- event type/value와 관계 ID만 저장한다.
- 표시 문구는 RPC의 고정 CASE 표현으로 생성한다.
- 신고 상세·관리자 메모·관리자 ID는 사용자 알림 응답에 포함하지 않는다.

### 5. 삭제된 원본과 FK 정책

**문제**

원본 댓글·랭킹·아이템을 hard delete하면 알림 FK가 삭제를 막거나 알림까지 연쇄 삭제할 수 있다.

**보완**

- 댓글·랭킹·아이템 FK는 `ON DELETE SET NULL`을 사용한다.
- 알림은 generic fallback 문구로 남긴다.
- href는 현재 공개 대상이 확인될 때만 반환한다.
- 신고 decision FK는 감사 무결성을 위해 `ON DELETE RESTRICT`를 유지한다.

### 6. 수신자 탈퇴 처리

**문제**

탈퇴한 사용자에게 알림을 영구 보존할 필요가 없으며 recipient FK를 NULL로 만들면 소유권 없는 개인 데이터가 남는다.

**보완**

- `recipient_id`는 `ON DELETE CASCADE`로 처리한다.
- actor는 이력 표시용이므로 탈퇴 시 NULL 처리한다.
- NULL reporter에는 신고 결과 알림을 만들지 않는다.

### 7. 자기 행동 알림

**문제**

사용자가 자신의 댓글에 답글을 작성하거나 관리자가 자신의 일반 계정 댓글을 처리할 때 불필요한 자기 알림이 생길 수 있다.

**보완**

- 답글은 recipient와 actor가 같으면 생성하지 않는다.
- Moderation·신고 결과는 운영 결과 전달이므로 actor와 recipient가 같더라도 생성 정책을 유지하되 actor 정보는 노출하지 않는다.

### 8. Moderation 알림 과다 생성

**문제**

동일 상태에서 메모만 추가한 재검토까지 알림을 만들면 사용자에게 상태 변화가 없는 이벤트가 반복된다.

**보완**

- `decision_source='manual'`인 댓글 review만 대상이다.
- `previous_status IS DISTINCT FROM decision_status`일 때만 생성한다.
- 자동 create/edit 판정은 별도 알림을 만들지 않는다.

### 9. 신고 처리 시점과 pending reporter 집합

**문제**

`comment_report_decisions` insert 후 신고 행이 resolved로 갱신되므로, trigger가 실행되는 시점에 어떤 신고자를 통지해야 하는지 명확해야 한다.

**보완**

- AFTER INSERT trigger는 동일 트랜잭션에서 아직 pending인 해당 댓글 신고만 조회한다.
- 기존 review RPC가 댓글 사건 advisory lock과 pending row lock을 보유하므로 reporter 집합은 안정적이다.
- dedupe key에 decision ID와 recipient ID를 포함한다.

### 10. 신고 결과와 작성자 경고의 중복 의미

**문제**

댓글 작성자는 Moderation 변경과 경고 알림을 동시에 받을 수 있다.

**보완**

- 두 이벤트는 공개 상태 변화와 계정 운영 이력이라는 서로 다른 의미이므로 분리한다.
- UI는 event type별 고정 문구를 사용한다.
- 계정 권한 정지와 같은 실제 제재는 이번 범위에 포함하지 않는다.

### 11. 목록 pagination과 unread count

**문제**

offset pagination은 새 알림이 들어올 때 중복·누락이 발생하며 Navbar count가 전체 테이블 scan을 유발할 수 있다.

**보완**

- 목록은 `(created_at, id)` keyset pagination을 사용한다.
- unread partial index를 추가한다.
- Navbar count 실패는 전체 레이아웃 실패로 전파하지 않는다.

### 12. 읽음 처리 경쟁 조건

**문제**

동일 알림을 여러 탭에서 읽으면 read timestamp가 계속 바뀌거나 타인 ID가 갱신될 수 있다.

**보완**

- `read_at = COALESCE(read_at, NOW())`로 최초 읽음 시각을 보존한다.
- UPDATE 조건에 `recipient_id=auth.uid()`를 강제한다.
- 없는 ID와 타인 ID는 동일하게 `P0002`로 처리한다.

### 13. retention 실행 권한

**문제**

일반 사용자가 retention RPC를 실행할 수 있으면 다른 사용자의 알림을 삭제할 수 있다.

**보완**

- retention RPC는 service role에만 EXECUTE를 부여한다.
- 함수 내부에서도 `auth.role()='service_role'`을 검증한다.
- 읽음 90일, unread 180일 경계를 명시한다.

## 최종 구현 승인 조건

1. 핵심 댓글·Moderation·신고 함수 전체 재정의 금지
2. direct table access 금지
3. 본인 소유 RPC 강제
4. 자유 형식 payload·본문 snapshot 금지
5. idempotent dedupe key
6. 현재 공개 대상만 href 반환
7. manual 상태 변경만 Moderation 알림 생성
8. pending reporter 집합만 신고 결과 통지
9. 개별·전체 읽음 처리의 소유권 검증
10. retention service-role 제한
11. Hosted 이벤트별 스모크 테스트
12. exact-head CI 성공 전 완료 판정 금지
