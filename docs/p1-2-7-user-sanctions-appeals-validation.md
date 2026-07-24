# P1-2.7 Hosted 검증

## 적용된 Hosted 마이그레이션

- `p1_2_7_user_sanctions_schema`
- `p1_2_7_user_sanction_core`
- `p1_2_7_sanction_mutations_and_notifications`
- `p1_2_7_sanction_query_rpcs`
- `p1_2_7_capability_enforcement`

## 검증 시나리오

테스트용 일반 사용자 계정에 24시간 댓글 제한을 관리자 RPC로 생성했다.

- 제재 생성 결과: `active`
- 제재 ID: `bb2e7a8b-7edb-4186-b1e2-1365e9826fbf`
- 이의제기 제출 결과: `pending`
- 이의제기 ID: `629fcbae-b6f5-4d1c-8d96-29f364b39e2a`
- 관리자 수용 결과: `accepted`
- 최종 projection: `overturned`
- Appeal decision audit ID: `1`

## 검증 의미

- 관리자 명시 결정만으로 기간제 제재가 생성된다.
- 본인만 자신의 제재에 이의제기할 수 있다.
- 제재당 단일 이의제기 계약이 적용된다.
- 수용 결정은 원장을 수정하지 않고 `overturned` 종료 이벤트를 추가한다.
- 현재 상태 projection은 원결정 취소 상태로 전환된다.
- 제재 및 이의제기 결과 알림 계약이 유지된다.

검증 데이터는 append-only 감사 체계의 Hosted smoke evidence로 유지한다. 대상은 운영 일반 사용자가 아닌 테스트 전용 계정이다.
