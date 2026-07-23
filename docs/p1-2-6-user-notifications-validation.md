# P1-2.6 사용자 알림 검증

## Hosted Supabase

적용 마이그레이션:

- `p1_2_6_notifications_schema`
- `p1_2_6_notification_rpcs`
- `p1_2_6_notification_events`
- `p1_2_6_notification_event_hardening`
- `p1_2_6_notification_link_hardening`

## 이벤트 스모크 테스트

임시 공개 랭킹과 댓글을 생성하여 다음 이벤트를 검증했다.

1. 타 사용자의 공개 답글 생성
   - `comment_reply` 생성
   - recipient: 원댓글 작성자
   - actor: 답글 작성자
2. 수동 Moderation review 삽입
   - `comment_moderation_changed` 생성
   - 상태 값 `blocked` 전달
3. 신고 decision 연결 및 신고 resolved 전환
   - `comment_report_resolved` 생성
   - 신고자별 dedupe key 생성
   - decision INSERT 이전/이후 순서 문제 보완 확인

조회 RPC 결과:

- 세 알림 모두 본인 목록에 노출
- 읽지 않음 개수 3
- 공개 랭킹 링크는 `/rankings/{slug}#comments-heading`
- 답글만 actor 표시 이름 반환
- Moderation·신고 결과는 관리자 식별 정보를 메시지에 노출하지 않음

읽음 처리:

- 개별 읽음 후 unread `3 → 2`
- 모두 읽음 처리 결과 2건
- 최종 unread 0

## 권한 검증

- anon notifications SELECT: 거부
- authenticated notifications SELECT: 거부
- authenticated notifications INSERT: 거부
- anon list RPC EXECUTE: 거부
- authenticated list RPC EXECUTE: 허용
- authenticated private emit helper EXECUTE: 거부

## 데이터 정리

- 임시 notifications: 0
- 임시 comments: 0
- 임시 ranking: 0
- append-only Moderation smoke evidence: 1건 유지

감사 이력은 기존 정책상 삭제하지 않았다.

## 잔여 검증 조건

- PR exact-head에서 ESLint와 Next.js build가 성공해야 한다.
- PR은 사용자 명시 승인 전 병합하지 않는다.
