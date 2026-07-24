# P1-2.8 관리자 권한 분리·고위험 운영 감사 설계

## 1. 목적

기존 단일 `admin` 역할에 집중된 콘텐츠 관리, Moderation, 신고 처리, 제재, 이의제기 및 역할 관리 권한을 `moderator`, `admin`, `super_admin`으로 분리한다. 화면 표시가 아니라 데이터베이스 RPC를 최종 권한 경계로 삼고 역할 변경과 주요 운영 결정을 감사 가능한 형태로 보존한다.

## 2. 범위

- 운영 역할 계층과 capability 판정
- 역할 변경 RPC와 Append-only 감사 원장
- 자기 역할 변경 및 마지막 최고 관리자 제거 차단
- 경로·서버 액션·RPC의 동일 권한 계약
- 고위험 제재 및 이의제기 결정 분리
- 통합 운영 감사 화면
- 기존 관리자 계정의 무중단 최고 관리자 이관

## 3. 비범위

- 2인 승인
- 영구 계정 정지
- 사용자별 예외 capability
- 조직·테넌트별 역할
- 외부 SIEM과 관리자 IP 제한

## 4. 역할 저장 모델

`user_roles`의 다중 행 구조를 유지하고 implied-role 형태로 저장한다.

| 운영 수준 | 저장 행 |
|---|---|
| `none` | 운영 역할 없음 |
| `moderator` | `moderator` |
| `admin` | `moderator`, `admin` |
| `super_admin` | `moderator`, `admin`, `super_admin` |

이 구조는 기존 `role='admin'` 및 `is_admin()` 계약을 관리자 이상에서 유지하면서 모더레이터의 CMS 권한 상승을 방지한다.

## 5. 최종 capability 계약

| capability | moderator | admin | super_admin |
|---|---:|---:|---:|
| `admin_console_access` | O | O | O |
| `moderation_review` | O | O | O |
| `report_review` | X | O | O |
| `sanction_view` | X | O | O |
| `sanction_impose_warning` | X | O | O |
| `content_manage` | X | O | O |
| `sanction_impose_restriction` | X | O | O |
| `appeal_reject` | X | O | O |
| `audit_view` | X | O | O |
| `sanction_impose_long_suspension` | X | X | O |
| `sanction_revoke` | X | X | O |
| `appeal_accept` | X | X | O |
| `role_manage` | X | X | O |

`account_suspension`은 168시간 이하를 관리자 이상이 처리하고, 이를 초과하면 최고 관리자만 처리한다.

## 6. 데이터 모델

### `admin_role_change_events`

역할 변경의 Append-only 감사 원장이다.

- 대상 사용자
- 변경 전·후 운영 수준
- 처리자
- 10~2,000자의 변경 사유
- 생성 시각

UPDATE와 DELETE는 trigger로 차단한다. 브라우저 역할은 테이블에 직접 접근할 수 없다.

### 현재 상태

별도 projection 없이 정규화된 `user_roles` implied-role 행이 현재 역할 상태다. 변경 RPC가 기존 운영 역할 행을 삭제하고 새 계층 행을 한 트랜잭션에서 재구성한다.

## 7. 핵심 함수

### private

- `private.get_admin_role_level(user_id)`
- `private.has_admin_capability(user_id, capability)`
- `private.assert_admin_capability(capability)`
- `private.set_admin_role_level(...)`

### public

- `public.has_admin_capability(capability)`
- `public.get_my_admin_access()`
- `public.search_admin_role_candidates(query, limit)`
- `public.set_admin_role_level(target_user_id, new_level, reason)`
- `public.list_admin_role_change_events(limit, offset)`
- `public.list_admin_audit_events(limit, offset)`

## 8. 역할 변경 불변식

1. 변경자는 `super_admin`이어야 한다.
2. 자기 자신의 운영 역할은 변경할 수 없다.
3. 마지막 `super_admin`은 제거하거나 강등할 수 없다.
4. 동일 수준 no-op은 거부한다.
5. 대상은 실제 profile이어야 한다.
6. 역할 변경 전체를 전역 advisory transaction lock으로 직렬화한다.
7. 대상별 advisory lock도 추가로 획득한다.
8. API 역할의 `user_roles` INSERT·UPDATE·DELETE는 차단한다.
9. 모든 성공 변경은 감사 원장에 기록한다.

## 9. 권한 재배치

- 댓글 Moderation queue·review: `moderation_review`
- 댓글 신고 queue·review: `report_review`
- CMS 콘텐츠 변경: `content_manage`
- 제재 조회: `sanction_view`
- 경고와 일반 기간 제한: 각각 `sanction_impose_warning`, `sanction_impose_restriction`
- 168시간 초과 계정 활동 제한: `sanction_impose_long_suspension`
- 조기 해제: `sanction_revoke`
- 이의제기 기각: `appeal_reject`
- 이의제기 수용: `appeal_accept`
- 역할 변경: `role_manage`

## 10. 애플리케이션 경계

- middleware가 `/admin` 경로별 capability를 조기 검사한다.
- Navbar와 운영 대시보드는 `get_my_admin_access()` 결과에 따라 메뉴를 표시한다.
- 서버 액션은 작업별 capability를 다시 확인한다.
- SECURITY DEFINER RPC가 최종 authoritative gate다.
- `/admin/access-control`은 최고 관리자 전용이다.
- `/admin/audit`은 관리자 이상 전용이다.

## 11. 통합 감사

다음 원장을 수정 없이 UNION하는 읽기 모델을 제공한다.

- 역할 변경
- 수동 Moderation review
- 댓글 신고 결정
- 제재 이벤트
- 이의제기 결정

반환 정보는 종류, 처리자, 대상, 작업, 요약 details와 시각으로 제한한다.

## 12. 마이그레이션 전략

1. 역할 constraint 확장과 기존 관리자 최고 관리자 이관
2. capability helper 및 역할 감사 원장 생성
3. 역할 관리 RPC와 전역 동시성 보호
4. 고위험 제재·이의제기 RPC 재정의
5. 모더레이터용 댓글 Moderation queue와 RLS 전환
6. 직접 역할 쓰기 권한 회수

## 13. 검증 계획

- 기존 관리자의 `super_admin` 이관
- 모더레이터 allow/deny capability matrix
- 관리자와 최고 관리자의 고위험 작업 경계
- 직접 역할 테이블 쓰기와 private helper 실행 차단
- 자기 변경·마지막 최고 관리자·동시 역할 변경 보호 구조
- 테스트 역할 원상 복구와 감사 이력 보존
- exact-head lint 및 production build
