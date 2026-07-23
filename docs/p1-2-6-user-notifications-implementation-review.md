# P1-2.6 사용자 알림 구현 리뷰

## 결론

구현은 P1-2.6 범위를 충족한다. 알림 저장소는 사용자 직접 접근을 차단하고, 이벤트 생성은 데이터베이스 트리거와 private helper로 제한했다. 공개 UI는 메시지와 안전한 내부 링크만 소비한다.

## 구현 리뷰 발견 사항

### 1. 신고 처리 알림 생성 시점

초기 구현은 `comment_report_decisions` 삽입 직후 신고자를 조회했다. 그러나 기존 사건 처리 RPC는 decision을 먼저 삽입하고 이후 `comment_reports.decision_id`를 갱신하므로, AFTER INSERT 시점에는 신고자를 찾을 수 없었다.

보완:

- 작성자 경고는 decision AFTER INSERT에서 생성한다.
- 신고자 처리 결과는 `comment_reports`가 resolved/dismissed로 전환되고 decision_id가 연결되는 AFTER UPDATE에서 생성한다.
- 사용자별 dedupe key로 동일 사건 중복 알림을 차단한다.

### 2. 존재하지 않는 댓글 DOM anchor

초기 링크는 `#comment-{uuid}`를 사용했으나 댓글 카드에 해당 id가 없었다.

보완:

- 안정적으로 존재하는 `#comments-heading`으로 이동한다.
- 원본 콘텐츠가 비공개 또는 삭제되면 href를 NULL로 반환한다.

### 3. 알림 생성과 핵심 트랜잭션

알림 트리거 실패는 댓글·Moderation·신고 처리 트랜잭션을 실패시킨다. 이번 단계에서는 알림을 핵심 사용자 계약으로 간주하여 원자적 처리를 유지한다.

보완:

- helper 입력은 event shape 제약과 dedupe key로 제한한다.
- 임의 사용자 직접 INSERT 권한은 부여하지 않는다.
- 후속 대규모 트래픽 단계에서 outbox 전환 여부를 검토한다.

### 4. Self-notification

작성자와 actor가 동일하면 알림을 만들지 않는다. 관리자 본인이 자신의 댓글을 검토하는 비정상 운영 경로에서도 자기 알림이 발생하지 않는다.

### 5. 감사 데이터와 알림 수명 분리

알림은 사용자 편의 데이터이며 감사 원장은 아니다.

- 읽은 알림: 90일
- 읽지 않은 알림: 180일
- Moderation review와 report decision은 별도 감사 정책을 유지한다.

## 최종 구현 상태

- 답글 알림
- 수동 댓글 Moderation 상태 변경 알림
- 신고 처리 결과 알림
- 작성자 경고 알림
- 읽지 않음 개수
- 개별·전체 읽음 처리
- keyset pagination
- 사용자 전용 RPC
- Navbar badge
- 안전한 fallback 링크
- service-role retention RPC
