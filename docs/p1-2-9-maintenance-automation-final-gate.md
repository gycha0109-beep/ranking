# P1-2.9 최종 게이트

## 완료 조건

- [x] 운영 유지보수 자동화 설계
- [x] 설계 리뷰와 실패·권한·보존정책 보완
- [x] bounded batch helper 구현
- [x] 중앙 유지보수 runner와 실행 원장 구현
- [x] 기존 service-role RPC 호환성 유지
- [x] pg_cron 6개 작업 등록
- [x] 중복 실행 advisory lock 구현
- [x] 신고 상세 비식별화 정책 구현
- [x] Cron 실행 이력 정리 구현
- [x] 관리자 조회 전용 화면 구현
- [x] 통합 운영 감사 연동
- [x] 구현 리뷰 및 batch accounting 보완
- [x] Hosted migration 적용
- [x] Hosted 권한·삭제·원장 검증
- [x] 검증 fixture rollback 확인
- [ ] exact-head GitHub Actions lint/build 성공
- [ ] 사용자 명시적 병합 승인

## 병합 정책

PR exact head에서 CI가 성공하더라도 사용자 승인 전에는 병합하지 않는다.
