# P1-2.6 최종 리뷰

최종 구조는 사용자 편의 데이터와 운영 감사 데이터를 분리한다.

- 알림은 recipient 전용 RPC로만 조회·변경한다.
- 감사 원장인 moderation_reviews와 comment_report_decisions를 알림 테이블로 대체하지 않는다.
- 알림 생성은 원본 업무 트랜잭션과 동일한 DB 트랜잭션에서 수행한다.
- dedupe key로 trigger 재실행과 중복 전달을 차단한다.
- 신고 처리 알림은 decision INSERT가 아니라 report row에 decision_id가 연결된 시점에 생성한다.
- 공개 불가능한 원본에는 링크를 제공하지 않는다.
- 알림은 retention 대상이며 감사 기록은 별도 보존된다.

현재 범위에서 차단급 미해결 사항은 없다. 대규모 트래픽에서 트리거 비용이 문제가 되면 후속 단계에서 transactional outbox로 전환한다.
