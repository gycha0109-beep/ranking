# P1-2.8 관리자 권한 분리·고위험 운영 감사 설계 리뷰

## 리뷰 결론

역할 계층을 단순 문자열 비교가 아니라 capability 계약으로 분리하는 방향은 타당하다. 기존 `admin` 의존 코드와 RLS가 넓게 퍼져 있으므로, `super_admin`이 기존 `admin` implied-role을 함께 보유하도록 해야 무중단 전환이 가능하다. `moderator`는 절대 `admin` 행을 가져서는 안 된다.

## 발견 사항과 보완

### 1. 기존 `admin` 검사와 호환성

**문제**

기존 코드와 정책은 `role = 'admin'` 또는 `public.is_admin()`에 의존한다. 기존 admin 행을 단순히 `super_admin`으로 치환하면 관리자 CMS 전체가 즉시 잠긴다.

**보완**

- 기존 admin 행은 유지한다.
- 기존 admin 사용자에게 `moderator`, `super_admin` 행을 추가한다.
- 향후 `super_admin` 지정 시 `moderator`, `admin`, `super_admin`을 모두 원자적으로 저장한다.
- `admin` 지정 시 `moderator`, `admin`을 저장한다.

### 2. moderator의 CMS 권한 상승 위험

**문제**

`public.is_admin()`을 staff 전체로 확장하면 moderator가 기존 RLS와 CMS RPC를 통해 카테고리, 아이템, 랭킹을 수정할 수 있다.

**보완**

- `public.is_admin()`은 기존 의미를 유지한다.
- moderator 허용이 필요한 댓글 Moderation·신고 함수만 capability 검사로 교체한다.
- middleware에서 경로별 capability를 적용한다.

### 3. implied-role 불일치

**문제**

직접 table write가 남아 있으면 `super_admin`만 있고 `admin`이 없는 불완전 상태를 만들 수 있다.

**보완**

- API 역할의 `user_roles` INSERT/UPDATE/DELETE를 회수한다.
- 기존 관리자 write RLS policy를 제거한다.
- staff 역할 변경은 `set_admin_role_level` RPC만 허용한다.
- RPC는 대상의 운영 역할 행을 모두 삭제한 후 정규 implied set을 삽입한다.

### 4. 마지막 super_admin 경쟁 조건

**문제**

두 요청이 동시에 서로 다른 super_admin을 강등하면 각 트랜잭션에서 다른 한 명을 보고 모두 성공할 수 있다.

**보완**

- 전역 advisory transaction lock을 역할 변경 전에 획득한다.
- 대상별 advisory lock도 함께 사용한다.
- 변경 직전 super_admin 수를 다시 계산한다.

### 5. 자기 자신 역할 변경

**문제**

super_admin이 자신의 역할을 올리거나 내리는 기능은 실수, 감사 회피, 마지막 관리자 제거의 원인이 된다.

**보완**

- 자기 자신 대상 역할 변경은 수준과 관계없이 거부한다.
- 초기 단일 super_admin은 다른 super_admin을 먼저 지정한 뒤에만 자신의 변경을 타인에게 요청할 수 있다.

### 6. 고위험 제재 경계

**문제**

`account_suspension`의 기간 제한만 검사하면 댓글·신고 제한을 1년 부과하는 것은 일반 admin에게 계속 허용된다.

**보완**

- 이번 단계의 고위험 기준은 계정 전체 활동 제한에 한정한다.
- 댓글·신고 제한은 최대 365일 기존 계약을 유지한다.
- account suspension 720시간 초과만 `super_admin`으로 제한한다.
- 향후 정책상 필요하면 제한 종류별 상한을 별도 단계에서 조정한다.

### 7. 이의제기 수용과 기각 권한

**문제**

수용과 기각을 동일 권한으로 두면 일반 admin이 원결정을 취소할 수 있다.

**보완**

- 기각은 `appeal_reject`로 admin 이상.
- 수용은 `appeal_accept`로 super_admin 전용.
- DB가 decision 값에 따라 capability를 분기한다.

### 8. moderator의 경고 기록

**문제**

댓글 신고 검토에서 `author_action=warning`은 제재 원장에 warning을 생성한다. 기존 private helper가 actor의 `admin` 행을 요구하면 moderator의 정상 신고 처리가 실패한다.

**보완**

- 제재 생성 helper는 제재 유형별 capability를 검사한다.
- warning은 `sanction_impose_warning`을 요구한다.
- 기능 제한은 `sanction_impose_restriction` 이상을 요구한다.
- 자동 trigger도 동일 helper를 사용한다.

### 9. 관리자 화면과 DB 권한의 불일치

**문제**

화면에서 버튼을 숨겨도 직접 RPC 호출은 가능하다. 반대로 DB만 막고 화면을 그대로 두면 반복 실패와 운영 혼란이 발생한다.

**보완**

- DB RPC를 authoritative gate로 둔다.
- `get_my_admin_access()` 결과로 메뉴와 버튼을 함께 제한한다.
- middleware는 경로 접근을 조기에 차단한다.

### 10. 통합 감사의 민감 정보

**문제**

서로 다른 원장을 단순 UNION하면 신고 상세, 사용자 이의제기 원문, 관리자 내부 메모가 과도하게 노출될 수 있다.

**보완**

- 통합 감사는 요약 필드만 반환한다.
- 상세 원문은 기존 전용 운영 화면에서만 확인한다.
- moderator는 통합 감사에 접근할 수 없고 admin 이상만 조회한다.

### 11. 역할 변경 대상 검색

**문제**

이메일 검색을 노출하면 필요 이상의 계정 식별 정보가 관리자 화면에 확산된다.

**보완**

- display name과 UUID만 검색한다.
- 이메일은 반환하지 않는다.
- 검색어 최소 2자, 최대 결과 50개로 제한한다.

### 12. bootstrap 계정

**문제**

개발용 bootstrap 로직이 `admin` 한 행만 넣으면 super-admin 전용 기능을 사용할 수 없고 implied-role 불변식이 깨진다.

**보완**

- 기존 production 데이터는 migration으로 정규화한다.
- 앱의 bootstrap 경로는 별도 후속 정리 대상으로 문서화한다.
- 이번 구현에서는 직접 역할 write를 차단하므로 bootstrap도 역할 관리 RPC 또는 service-role 전용 정규화 함수로만 처리해야 한다.

## 최종 구현 조건

1. 기존 admin 무중단 호환
2. moderator의 CMS 권한 상승 차단
3. implied-role 원자 재구성
4. 전역 lock 기반 마지막 super_admin 보호
5. 자기 역할 변경 전면 금지
6. account suspension 30일 초과 super_admin 전용
7. 이의제기 수용 super_admin 전용
8. moderator warning trigger 정상 동작
9. middleware·UI·DB 3중 권한 일치
10. 통합 감사 최소 정보 노출
11. 이메일 비노출 사용자 검색
12. user_roles 직접 쓰기 제거
