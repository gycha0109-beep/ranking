# P1-2.6 Hosted DB 적용 메모

호스팅 DB에는 개발 중 최종 계약에 도달하기 위해 다음 순서로 적용했다.

- notifications schema
- notification RPCs
- notification events
- report delivery hardening
- stable comment-section link hardening

저장소 신규 환경 기준은 `20260723020000`부터 `20260723023000`까지 순차 적용한다. 최종 `20260723021000` 파일에는 안정적인 `#comments-heading` 링크가 이미 반영되어 있으므로 hosted 전용 link hardening을 별도 재현할 필요가 없다.
