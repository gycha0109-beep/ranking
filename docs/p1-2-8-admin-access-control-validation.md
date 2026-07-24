# P1-2.8 Hosted 검증

## 적용 마이그레이션

- `p1_2_8_admin_role_capabilities`
- `p1_2_8_role_management_and_enforcement`
- `p1_2_8_role_management_reconciliation`
- `p1_2_8_high_risk_operator_enforcement`
- `p1_2_8_moderator_queue_access`

최초 schema migration 검증 중 bootstrap INSERT의 `NULL` 타입 추론 오류를 발견했다. `NULL::UUID`와 TEXT 명시 캐스트로 수정한 뒤 Hosted 적용에 성공했다.

## 역할 이관

기존 단일 관리자 계정은 다음 계층 역할을 모두 보유하도록 이관했다.

- `moderator`
- `admin`
- `super_admin`

최종 계산 역할은 `super_admin`이며, 마지막 최고 관리자 보호 조건을 만족한다.

## Capability matrix smoke

테스트 계정에 임시 `moderator` 역할을 부여하고 다음 결과를 확인했다.

| capability | 결과 |
|---|---:|
| `admin_console_access` | 허용 |
| `moderation_review` | 허용 |
| `report_review` | 거부 |
| `content_manage` | 거부 |
| `sanction_view` | 거부 |
| `sanction_impose_warning` | 거부 |
| `sanction_impose_restriction` | 거부 |
| `appeal_reject` | 거부 |
| `audit_view` | 거부 |
| `sanction_revoke` | 거부 |
| `appeal_accept` | 거부 |
| `role_manage` | 거부 |

검증 후 테스트 계정 역할은 `none`으로 복원했다. 역할 부여와 복원 이력 2건은 Append-only smoke evidence로 유지한다.

## 권한 행렬

- authenticated `user_roles` INSERT: false
- authenticated `user_roles` UPDATE: false
- authenticated `user_roles` DELETE: false
- authenticated 역할 감사 테이블 직접 SELECT: false
- authenticated private 역할 변경 helper EXECUTE: false
- authenticated public 역할 변경 RPC EXECUTE: true
- anon public 역할 변경 RPC EXECUTE: false
- authenticated 본인 운영 접근 RPC EXECUTE: true
- anon 본인 운영 접근 RPC EXECUTE: false

공개 RPC의 EXECUTE 권한은 호출 가능 여부만 의미하며, 내부 capability 검사가 최고 관리자 외 호출을 거부한다.

## 최종 데이터 상태

- 운영 주 계정: `super_admin`
- 테스트 계정: `none`
- 테스트 계정 역할 감사 이벤트: 2건
- 임시 운영 역할 잔존: 없음

## 검증 결론

역할 계층, 최소 capability, 직접 쓰기 차단, private helper 차단, 감사 기록 및 테스트 데이터 복원까지 확인했다.
