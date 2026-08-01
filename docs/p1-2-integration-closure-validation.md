# P1-2 통합 회귀 검증·운영 마감 Hosted 검증

## 기준

- Hosted project: `yjdubukqkcvkymabskzd`
- migration: `p1_2_integration_sanction_enforcement`
- fixture 방식: transaction 내부 생성 후 전체 rollback

## 검증 결과

### Migration 및 객체

- Hosted migration history 등록 확인
- 댓글 제재 trigger 활성 확인
- 신고 제재 trigger 활성 확인
- private trigger function의 anon/authenticated 실행 권한 없음 확인
- 좋아요·북마크 RPC의 anon 실행 불가 확인
- 좋아요·북마크 RPC의 authenticated 실행 가능 확인

### 상태 전이

일반 사용자 fixture와 공개 랭킹·아이템을 사용해 다음을 검증했다.

1. 제재 전 댓글 INSERT 성공
2. `comment_restriction` 적용 후 댓글 INSERT 차단
3. `comment_restriction` 적용 후 본문 UPDATE 차단
4. `report_restriction` 적용 후 `comment_reports` 직접 INSERT 차단
5. `account_suspension` 적용 후 랭킹 좋아요 차단
6. `account_suspension` 적용 후 아이템 좋아요 차단
7. `account_suspension` 적용 후 랭킹 북마크 차단
8. `account_suspension` 적용 후 아이템 북마크 차단
9. 정지 상태에서도 본인 제재 조회 허용
10. 정지 상태에서도 이의제기 제출 허용

차단 SQLSTATE는 사용자 제재 계약의 `P0003`을 유지했다.

### Rollback 청결성

검증 종료 후 다음 fixture 잔여량이 모두 0임을 확인했다.

- 임시 제재
- 임시 댓글
- 임시 이의제기

## 권한 및 데이터 경계

- 주요 append-only/운영 테이블은 anon 직접 조회 불가
- 주요 운영 테이블은 authenticated 직접 INSERT 불가
- engagement mutation은 authenticated RPC 경로로만 허용
- trigger는 RPC 우회 경로도 동일하게 차단

## 해석 제한

이번 검증은 Hosted 현재 스키마의 forward migration과 통합 상태 전이를 증명한다. 빈 DB 전체 bootstrap 검증은 포함하지 않는다.

## 결론

P1-2의 제재-댓글-신고-좋아요-북마크 연결 계약이 Hosted DB에서 통과했고, fixture는 모두 rollback됐다.
