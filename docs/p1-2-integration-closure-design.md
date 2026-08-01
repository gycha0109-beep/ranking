# P1-2 통합 회귀 검증·운영 마감 설계

## 목표

P1-2.1~P1-2.11에서 추가된 반응, 댓글, 신고, 제재, 알림, 운영 권한, 유지보수, 감사·보안 이벤트를 하나의 상태 전이 체계로 검증하고 P1-2를 공식 종료한다.

## 범위

1. 저장소 정적 계약 검증
2. Hosted Supabase 스키마·권한·상태 전이 검증
3. 마이그레이션 계보와 필수 P1-2 단계 누락 검사
4. 사용자 제재가 댓글·신고·좋아요·북마크 RPC에 실제 강제되는지 확인
5. 삭제·차단·비공개 콘텐츠가 공개 조회와 상호작용에서 제외되는지 확인
6. 신고 → 운영 결정 → 제재 → 이의제기 → 알림 → 감사 correlation 연결 확인
7. 유지보수 작업이 감사 원장을 보존하면서 파생·보존 대상 데이터만 정리하는지 확인
8. 발견 결함 수정 후 exact-head CI와 Hosted 재검증

## 비범위

- 신규 사용자 기능
- 검색 품질 개선
- UI 전면 개편
- 운영 원장 재작성
- 실제 운영 데이터 영구 변형

## 정적 검증 도구

`scripts/verify-p1-2-contracts.mjs`를 추가한다.

검증 항목:

- 모든 migration 파일명 timestamp와 migration name 중복 금지
- P1-2.1~P1-2.11 필수 migration marker 존재
- 모든 P1-2 migration이 transaction 경계를 명시
- 필수 보안 migration에 RLS·REVOKE·SECURITY DEFINER 계약 존재
- CI에서 정적 계약 검증 실행
- 검증 실패 시 누락 항목을 명시하고 non-zero 종료

이 검사는 Hosted DB 테스트를 대체하지 않으며, 신규 환경에서 migration 파일 누락·이중 계보가 발생하는 것을 조기에 차단한다.

## Hosted 검증 원칙

- 실제 사용자 계정을 사용하되 모든 mutable fixture는 단일 transaction에서 생성하고 rollback한다.
- append-only 감사 원장에 불필요한 검증 흔적을 남기는 테스트는 피한다.
- 감사 원장 기록이 필수인 흐름은 별도 disposable fixture 계정 또는 기존 검증 증거를 조회하여 검증한다.
- 원문 댓글·메모·신고 상세는 결과 보고에 노출하지 않는다.

## 상태 전이 검증

### 사용자 반응

- 공개·안전 랭킹/아이템만 좋아요·북마크 가능
- 동일 상태 설정은 멱등
- 제재된 계정은 정책에 따라 mutation 차단
- 원본 테이블 직접 접근 차단

### 댓글·신고

- 댓글과 답글은 1단 깊이
- 삭제 parent tombstone과 child 보존
- needs_review/blocked 댓글 공개 차단
- 본인 신고 및 중복 신고 차단
- 신고 결정과 Moderation 변경 원자성

### 제재·이의제기

- active restriction이 관련 RPC에서 DB 단으로 강제
- 만료·해제·overturned 상태 구분
- 제재당 이의제기 1회
- 관리자 계정 제재 차단

### 알림·감사

- 답글·Moderation·신고 결정·제재 관련 알림 dedupe
- 삭제·비공개 대상 링크 fallback
- 감사 root correlation과 sanction group 연결
- 민감 근거는 super_admin 전용

### 유지보수

- bounded batch와 advisory lock
- 원장 삭제 금지
- notification, view, blocked body, report detail, security telemetry만 정책에 따라 정리
- cron definition과 runner case 일치

## 완료 조건

- 정적 계약 검증이 CI에 포함됨
- Hosted matrix 전 항목 통과 또는 명시적 결함 수정
- migration history와 저장소 필수 계보 일치
- lint·build·contract check 성공
- 구현 리뷰에서 Critical/High 잔여 결함 없음
- PR은 사용자 승인 전 병합하지 않음
