# P1-2.8 관리자 권한 분리·고위험 운영 감사 설계

## 1. 목적

P1-2.7에서 사용자 제재와 이의제기 체계가 추가되면서 기존 단일 `admin` 역할에 콘텐츠 관리, Moderation, 신고 처리, 제재 부과, 제재 취소, 이의제기 수용, 관리자 권한 관리가 모두 집중되어 있다.

이번 단계에서는 운영 권한을 `moderator`, `admin`, `super_admin`으로 분리하고, 고위험 작업을 `super_admin`에 한정한다. 역할 변경과 주요 운영 결정을 append-only 감사 원장으로 남기며, 기존 기능과 Hosted 데이터의 연속성을 유지한다.

## 2. 범위

- `moderator / admin / super_admin` 운영 역할 계층
- capability 기반 권한 판정
- 관리자 역할 수준 변경 RPC
- 역할 변경 append-only 감사 원장
- 마지막 `super_admin` 제거 방지
- 자기 자신의 운영 역할 변경 차단
- Moderation·댓글 신고·계정 제재 권한 분리
- 장기 계정 활동 제한, 제재 취소, 이의제기 수용의 고위험 게이트
- 관리자 통합 감사 조회 RPC와 화면
- `/admin` 경로별 capability 보호
- 기존 단일 `admin` 계정의 무중단 `super_admin` 승격

## 3. 비범위

- 조직별 권한 또는 멀티테넌시
- 세밀한 사용자별 예외 권한
- 승인자 2인 결재
- 영구 계정 정지
- 관리자 IP allowlist
- 외부 SIEM 전송
- 이메일·푸시 보안 알림

## 4. 역할 모델

`user_roles`는 기존 `user`, `editor`, `admin` 역할과 다중 행 구조를 유지한다. 운영 역할은 계층형 implied-role 방식으로 저장한다.

| 운영 수준 | 저장되는 운영 역할 행 |
|---|---|
| `moderator` | `moderator` |
| `admin` | `moderator`, `admin` |
| `super_admin` | `moderator`, `admin`, `super_admin` |
| `none` | 운영 역할 없음 |

이 방식은 기존 코드의 `role = 'admin'` 검사와 `public.is_admin()`을 `admin` 및 `super_admin`에서 계속 동작하게 하면서, `moderator`가 CMS 전체 권한을 얻지 않도록 한다.

## 5. capability 계약

| capability | moderator | admin | super_admin |
|---|---:|---:|---:|
| `admin_console_access` | O | O | O |
| `moderation_review` | O | O | O |
| `report_review` | O | O | O |
| `sanction_view` | O | O | O |
| `sanction_impose_warning` | O | O | O |
| `content_manage` | X | O | O |
| `sanction_impose_restriction` | X | O | O |
| `appeal_reject` | X | O | O |
| `audit_view` | X | O | O |
| `sanction_impose_long_suspension` | X | X | O |
| `sanction_revoke` | X | X | O |
| `appeal_accept` | X | X | O |
| `role_manage` | X | X | O |

`account_suspension`은 720시간 이하만 일반 `admin`이 부과할 수 있다. 720시간 초과는 `super_admin` 전용이다.

## 6. 데이터 모델

### 6.1 `admin_role_change_events`

역할 수준 변경 감사 원장이다.

- `id BIGINT IDENTITY`
- `target_user_id UUID`
- `previous_level TEXT`
- `new_level TEXT`
- `actor_id UUID`
- `reason TEXT`
- `created_at TIMESTAMPTZ`

UPDATE와 DELETE는 trigger로 차단한다.

### 6.2 현재 역할 projection

별도 테이블을 만들지 않고 `user_roles`의 implied-role 행으로 현재 상태를 표현한다. 역할 변경은 RPC 한 곳에서만 수행하고, 대상 사용자의 운영 역할 행을 원자적으로 재구성한다.

## 7. 핵심 함수

### private

- `private.get_admin_role_level(user_id)`
- `private.has_admin_capability(user_id, capability)`
- `private.assert_admin_capability(capability)`
- `private.reject_admin_role_event_mutation()`

### public

- `public.has_admin_capability(capability)`
- `public.get_my_admin_access()`
- `public.list_admin_role_members()`
- `public.search_admin_role_candidates(query, limit)`
- `public.set_admin_role_level(target_user_id, new_level, reason)`
- `public.list_admin_audit_events(limit, offset)`

## 8. 역할 변경 불변식

1. 역할 변경자는 `super_admin`이어야 한다.
2. 자기 자신의 역할은 변경할 수 없다.
3. 마지막 `super_admin`을 제거하거나 강등할 수 없다.
4. 대상 사용자는 실제 `profiles` 사용자여야 한다.
5. 동일 수준으로의 no-op 변경은 거부한다.
6. 변경 사유는 10자 이상 2,000자 이하이다.
7. 대상별 advisory lock과 전역 super-admin lock을 사용한다.
8. `user_roles` 직접 INSERT/UPDATE/DELETE는 API 역할에서 차단한다.
9. 역할 원장 UPDATE/DELETE는 service role을 포함해 trigger로 차단한다.

## 9. 기존 운영 기능의 권한 재배치

### Moderation

- 댓글 Moderation queue와 review: `moderation_review`
- 랭킹·아이템·이미지·엔트리 Moderation: 기존 `is_admin()` 유지, 즉 `admin` 이상

### 댓글 신고

- queue, decision history, pending count, review: `report_review`
- 신고 처리에서 작성자 경고를 기록하는 것은 moderator까지 허용

### 사용자 제재

- 조회: `sanction_view`
- warning 부과: `sanction_impose_warning`
- 댓글·신고 제한 및 30일 이하 account suspension: `sanction_impose_restriction`
- 30일 초과 account suspension: `sanction_impose_long_suspension`
- 조기 해제: `sanction_revoke`
- 이의제기 기각: `appeal_reject`
- 이의제기 수용: `appeal_accept`

## 10. 관리자 통합 감사

`list_admin_audit_events`는 다음 append-only 원장을 하나의 정규화된 timeline으로 반환한다.

- 수동 Moderation review
- 댓글 신고 결정
- 사용자 제재 부과 및 종료 이벤트
- 이의제기 결정
- 관리자 역할 변경

반환 필드는 `source`, `action`, `actor`, `target`, `entity`, `summary`, `created_at`으로 제한한다. 상세 원문이나 신고자 정보는 노출하지 않는다.

## 11. 애플리케이션 변경

- middleware에서 `/admin` 하위 경로별 capability 검사
- Navbar 관리자 진입 조건을 `admin_console_access`로 변경
- 관리자 대시보드 메뉴를 capability에 따라 필터링
- `/admin/access-control` 추가
  - 현재 운영 역할 구성원
  - 사용자 검색
  - 역할 수준 변경
  - 통합 감사 timeline
- `/admin/user-sanctions`에서 권한에 따라 제재 유형, 장기 정지, 조기 해제, 이의제기 수용 버튼을 제한

화면 제한은 UX 보조이며 최종 권한 판정은 DB RPC에서 수행한다.

## 12. 마이그레이션 전략

1. 역할 constraint 확장 및 기존 admin 계정에 `moderator`, `super_admin` implied-role 추가
2. capability helper와 역할 감사 원장 생성
3. 역할 관리·조회·감사 RPC 생성
4. Moderation·신고 RPC capability 전환
5. 사용자 제재·이의제기 고위험 capability 전환
6. 직접 역할 쓰기 정책 제거와 권한 회수

모든 DDL은 Hosted migration history를 통해 적용한다.

## 13. 검증 계획

- 기존 유일 admin이 `super_admin`으로 무중단 승격되는지 확인
- moderator가 댓글 Moderation·신고 처리만 수행 가능한지 확인
- moderator가 CMS 쓰기와 제한 제재 부과를 거부당하는지 확인
- admin이 단기 제한을 부과하고 장기 정지를 거부당하는지 확인
- super_admin만 역할 변경, 장기 정지, 제재 해제, 이의제기 수용 가능한지 확인
- 자기 역할 변경과 마지막 super_admin 제거가 거부되는지 확인
- 역할 변경 원장 UPDATE/DELETE가 거부되는지 확인
- 사용자 역할 직접 쓰기가 차단되는지 확인
- 통합 감사 RPC가 권한별로 올바르게 동작하는지 확인
- 앱 lint·production build 통과
