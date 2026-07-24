# P1-2.7 사용자 계정 제재·이의제기 설계

## 1. 목적

댓글 Moderation, 댓글 신고, 운영 결정, 경고 알림 위에 계정 단위 제재와 이의제기 절차를 추가한다.

핵심 목표는 다음과 같다.

- 운영자가 사용자에게 경고, 댓글 작성 제한, 신고 제한, 계정 활동 정지를 부여할 수 있다.
- 제재 근거와 상태 전환을 append-only 감사 원장으로 보존한다.
- 현재 효력이 있는 제재는 별도 projection으로 빠르게 판정한다.
- 제재는 클라이언트 표시가 아니라 DB RPC 진입점에서 강제한다.
- 사용자는 자신의 제재만 조회하고 제재당 한 번 이의제기할 수 있다.
- 운영자는 이의제기를 수용 또는 기각하며 결과를 감사 기록과 알림으로 남긴다.
- 경고 누적 수만으로 자동 제재하지 않는다.

## 2. 비범위

- 인증 계정 자체 삭제 또는 Supabase Auth ban
- 영구 계정 정지
- 자동 점수 기반 제재
- 제재 단계 자동 승급
- 이메일·푸시 알림
- 사용자가 다른 사용자의 제재 내역을 조회하는 기능
- 제재 기록 삭제 또는 관리자 임의 수정

## 3. 제재 종류

| 종류 | 효력 | 기간 |
|---|---|---|
| `warning` | 감사 기록과 사용자 고지. 기능 제한 없음 | 기간 없음 |
| `comment_restriction` | 댓글 작성·답글·수정 차단 | 1시간 이상 365일 이하 |
| `report_restriction` | 댓글 신고 차단 | 1시간 이상 365일 이하 |
| `account_suspension` | 댓글·신고·좋아요·북마크 등 비필수 활동 차단 | 1시간 이상 365일 이하 |

사용자의 기존 콘텐츠 삭제는 안전·개인정보 통제를 위해 제재 중에도 허용한다. 제재 조회와 이의제기도 항상 허용한다.

## 4. 데이터 모델

### 4.1 `user_sanctions`

제재의 최초 결정을 보관하는 불변 원장이다.

- `id`
- `target_user_id`
- `sanction_type`
- `reason`
- `admin_note`
- `starts_at`
- `ends_at`
- `source_comment_id`
- `source_report_decision_id`
- `source_moderation_review_id`
- `created_by`
- `created_at`

규칙:

- `warning`은 `ends_at IS NULL`이다.
- 기능 제한 제재는 종료 시각이 필수이며 최대 365일이다.
- 관리자 메모는 최소 10자, 최대 2,000자다.
- 직접 UPDATE/DELETE를 금지한다.
- 동일 사용자의 동일 제재 종류가 현재 유효한 동안 중복 부여하지 않는다.

### 4.2 `user_sanction_events`

제재 상태 전환 원장이다.

- `imposed`: 최초 부여
- `revoked`: 운영자 수동 해제
- `expired`: 기간 만료 확정
- `overturned`: 이의제기 수용으로 원결정 취소

각 제재에는 `imposed`가 정확히 한 건 존재하며 종료 계열 이벤트는 최대 한 건만 존재한다. 직접 UPDATE/DELETE를 금지한다.

### 4.3 `user_sanction_states`

현재 상태 projection이다.

- `sanction_id`
- `state`: `active`, `revoked`, `expired`, `overturned`
- `last_event_id`
- `updated_at`

이 테이블은 원장이 아니며 검증된 내부 함수만 변경한다. 강제 판정은 projection과 원본의 시간 범위를 함께 확인한다. 만료 projection이 지연돼도 `ends_at <= now()`인 제재는 기능을 차단하지 않는다.

### 4.4 `user_sanction_appeals`

사용자의 최초 이의제기 원문이다.

- 제재당 최대 한 건
- 신청자와 제재 대상 사용자가 일치해야 함
- 20자 이상 2,000자 이하
- 직접 UPDATE/DELETE 금지

### 4.5 `user_sanction_appeal_decisions`

이의제기 운영 판단 원장이다.

- 이의제기당 최대 한 건
- `accepted` 또는 `rejected`
- 10자 이상 관리자 메모
- 수용 시 동일 트랜잭션에서 `overturned` 이벤트와 projection 변경
- 직접 UPDATE/DELETE 금지

## 5. 제재 근거와 추적성

제재는 다음 근거를 연결할 수 있다.

- 댓글
- 댓글 신고 사건 결정
- Moderation review

댓글 신고 처리에서 `author_action = warning`이 생성되면 동일 신고 결정에 연결된 `warning` 제재를 자동 생성한다. 기존 경고 결정도 migration에서 한 번만 backfill한다.

일반 관리자 부여 제재는 최소 10자의 관리자 메모를 필수로 하며 가능한 경우 근거 ID를 함께 저장한다.

## 6. 기능 강제

`private.assert_user_capability(user_id, capability)`를 단일 정책 진입점으로 사용한다.

| capability | 차단 제재 |
|---|---|
| `comment_write` | `comment_restriction`, `account_suspension` |
| `report_comment` | `report_restriction`, `account_suspension` |
| `engagement_write` | `account_suspension` |

강제 지점:

- 댓글 작성·답글
- 댓글 수정
- 댓글 신고
- 좋아요 설정
- 북마크 설정

댓글 삭제, 제재 조회, 이의제기 제출은 차단하지 않는다.

제재 위반은 SQLSTATE `P0003`으로 반환해 서버 액션이 `SANCTIONED` 상태로 구분한다.

## 7. 공개 RPC

### 사용자

- `list_my_user_sanctions(limit, offset)`
- `submit_user_sanction_appeal(sanction_id, statement)`

반환 정보는 본인의 제재와 이의제기 상태로 제한한다. 관리자 식별 정보와 내부 메모 원문은 사용자에게 노출하지 않고 정책 사유와 사용자용 설명만 반환한다.

### 관리자

- `search_user_sanction_candidates(query, limit)`
- `list_recent_user_sanctions(limit, offset)`
- `list_pending_user_sanction_appeals(limit, offset)`
- `get_pending_user_sanction_appeal_count()`
- `admin_impose_user_sanction(...)`
- `admin_revoke_user_sanction(sanction_id, note)`
- `review_user_sanction_appeal(appeal_id, decision, note)`

### 유지보수

- `expire_due_user_sanctions(limit)`

service role 전용이며 만료된 active projection을 `expired` 이벤트로 확정한다. 강제 로직은 이 작업의 실행 여부와 무관하게 시간 범위로 정확성을 유지한다.

## 8. 알림

기존 알림 시스템에 다음 유형을 추가한다.

- `user_sanction_imposed`
- `user_sanction_appeal_resolved`
- `user_sanction_ended`

알림은 제재 원장을 대체하지 않는다. 알림 유실 또는 retention 삭제가 발생해도 제재와 이의제기 감사 기록은 유지된다.

모든 제재 알림 링크는 `/me/sanctions`로 고정한다.

## 9. 관리자 화면

`/admin/user-sanctions`

- 사용자 검색
- 제재 부여
- 최근 제재와 현재 상태
- 수동 해제
- pending 이의제기 검토

관리자 대시보드에 pending 이의제기 수를 표시한다.

## 10. 사용자 화면

`/me/sanctions`

- 본인 제재 이력
- 현재 효력 상태와 종료 시각
- 정책 사유
- 이의제기 상태
- 제재당 한 번의 이의제기 제출

## 11. 트랜잭션 원칙

- 제재 부여: sanction + imposed event + projection + notification 단일 트랜잭션
- 수동 해제: revoked event + projection + notification 단일 트랜잭션
- 이의제기 수용: appeal decision + overturned event + projection + notification 단일 트랜잭션
- 이의제기 기각: appeal decision + notification 단일 트랜잭션
- 경고 자동 생성: report decision trigger 트랜잭션 내부

어느 단계든 실패하면 원본 운영 작업까지 롤백한다. 알림은 사용자 편의 데이터지만 제재 전달의 중요도가 높으므로 이번 단계에서는 원자적 생성을 선택한다.

## 12. 완료 조건

1. 원장 테이블 직접 접근 및 수정 차단
2. 동일 종류 active 제재 중복 방지
3. DB RPC 진입점의 capability 강제
4. 삭제와 이의제기 권리 보존
5. 제재당 단일 이의제기
6. 수용·기각 판단 append-only 기록
7. 수용 시 `overturned` 상태 원자 반영
8. 사용자 간 제재 정보 비노출
9. 알림 계약 확장과 안전한 링크
10. Hosted DB 검증 및 exact-head CI 성공
11. 사용자 승인 전 병합 금지
