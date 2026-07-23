# P1-2.6 PR 요약

## 사용자 기능

- 내 댓글 답글 알림
- 내 댓글 수동 Moderation 결과 알림
- 내가 제출한 댓글 신고 처리 결과 알림
- 작성자 경고 알림
- 읽지 않음 badge
- 개별·전체 읽음 처리
- 알림 keyset pagination

## 보안

- notifications 테이블 직접 접근 금지
- recipient는 auth.uid()로 고정
- private emit helper 비공개
- event shape DB 제약
- dedupe key 유일성
- 공개 가능한 내부 링크만 반환

## 운영

- 읽음 90일, 미확인 180일 retention RPC
- 감사 원장과 알림 수명 분리
- 사용자 승인 전 병합 금지
