# P1-2 통합 회귀 검증·운영 마감 구현 리뷰

## 결론

구현 범위는 설계 목적에 부합한다. 정적 계약 검증을 CI에 연결했고, Hosted DB에서 발견된 제재 우회 가능성을 DB 경계에서 보완했다. 다만 이번 단계가 빈 DB 전체 부트스트랩을 증명하는 것은 아니며, migration 계보 정적 검증과 Hosted forward 적용·상태 전이 검증으로 한정한다.

## 구현 검토

### 1. 정적 계약 검증

`scripts/verify-p1-2-contracts.mjs`는 다음을 검사한다.

- migration 파일명 규칙
- timestamp와 migration name 중복
- P1-2.1~P1-2.11 필수 단계 존재
- P1-2 migration의 transaction boundary 또는 명시적 예외 marker
- 주요 보안 신호 누락
- package script와 CI 연결

보안 문자열 검사는 최종 보안 판정이 아니라 누락 방지 장치다. 실제 권한과 상태 전이는 Hosted 검증 결과를 우선한다.

### 2. 댓글 제재 강제

`comments`에 `BEFORE INSERT OR UPDATE OF body` trigger를 추가했다.

- 신규 댓글 작성 시 `comment_write` 검사
- 본문 변경 시 `comment_write` 검사
- 본문이 바뀌지 않는 운영 상태 변경은 차단하지 않음

이로써 RPC 외 경로에서도 댓글 제한과 계정 정지가 강제된다.

### 3. 신고 제재 강제

`comment_reports`에 `BEFORE INSERT` trigger를 추가했다.

- reporter ID 기준으로 `report_comment` 검사
- 신고 제한과 계정 정지를 DB 경계에서 강제

### 4. 참여 mutation 제재 강제

좋아요와 북마크 public RPC 네 개를 PL/pgSQL wrapper로 교체하고 `engagement_write` 검사를 선행한다.

- `set_ranking_like`
- `set_item_like`
- `set_ranking_bookmark`
- `set_item_bookmark`

내부 helper의 기존 대상 공개성·rate limit·동시성 계약은 그대로 보존한다.

### 5. 권한

- private trigger function은 anon/authenticated 실행 불가
- public engagement RPC는 anon 실행 불가
- authenticated는 RPC 실행 가능하나 내부 제재 검사 적용
- 직접 table 접근 계약은 변경하지 않음

## 잔여 한계

- 브라우저 밖 service-role 작업은 정책상 별도 신뢰 경계다.
- 전체 migration을 빈 PostgreSQL/Supabase 인스턴스에 재생하는 CI는 포함하지 않았다.
- 계정 정지는 로그인, 본인 제재 조회, 이의제기를 막지 않는다.

## 리뷰 결과

차단 결함 없음. Hosted rollback 검증과 exact-head CI를 최종 gate로 사용한다.
