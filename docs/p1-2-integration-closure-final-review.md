# P1-2 통합 회귀 검증·운영 마감 최종 리뷰

## 완료 범위

- 설계
- 설계 리뷰
- 정적 migration 계약 검증기
- CI 연결
- Hosted 제재 우회 보완 migration
- 댓글·신고 trigger enforcement
- 좋아요·북마크 RPC enforcement
- rollback 기반 Hosted 상태 전이 검증
- 권한 matrix 및 fixture 잔여 검증

## 최종 판정

P1-2 기능군은 운영 마감 가능한 상태다.

- P1-2.1~P1-2.11 migration 계보가 CI에서 지속 검증된다.
- 댓글, 신고, 좋아요, 북마크 mutation은 제재 계약을 DB 경계에서 강제한다.
- 계정 정지 상태에서도 본인 제재 조회와 이의제기는 유지된다.
- Hosted 검증 데이터는 모두 rollback됐다.
- 기존 engagement helper의 공개성·rate limit·동시성 계약은 유지된다.

## 비대상

- 빈 Supabase 프로젝트에 전체 migration을 재생하는 Docker CI
- service-role 내부 운영 작업의 사용자 제재 적용
- P1-3 검색·탐색 품질 개선

## 병합 gate

1. PR exact-head에서 `npm run verify:p1-2` 성공
2. lint 성공
3. production build 성공
4. 사용자 명시적 승인 전 병합 금지

## 다음 단계

이 PR이 병합되면 P1-2를 종료하고 P1-3 검색·탐색 품질 단계로 전환한다.
