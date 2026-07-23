# P1-2.6 사용자 알림 시스템 설계

## 1. 목적

P1-2.4 댓글·답글과 P1-2.5 신고·운영 처리 흐름에서 사용자에게 필요한 결과를 개인 알림함으로 전달한다.

핵심 목표:

- 내 댓글에 타인이 답글을 작성하면 알림을 생성한다.
- 내 댓글의 수동 Moderation 상태가 실질적으로 변경되면 알림을 생성한다.
- 내가 제출한 댓글 신고가 처리되면 결과 알림을 생성한다.
- 댓글 신고 처리에서 작성자 경고가 기록되면 해당 작성자에게 알림을 생성한다.
- 사용자는 본인 알림만 조회하고 개별 또는 전체 읽음 처리할 수 있다.
- Navbar에서 읽지 않은 알림 수를 확인할 수 있다.
- 원본 댓글이나 콘텐츠가 삭제·비공개되어도 알림 목록은 안전하게 렌더링한다.

## 2. 비범위

- 이메일·푸시·SMS 발송
- 실시간 WebSocket 구독
- 사용자별 알림 유형 수신 거부 설정
- 관리자 공지 방송
- 계정 정지·이의제기 워크플로
- 외부 메시지 브로커와 비동기 fan-out

## 3. 설계 원칙

### 3.1 개인 데이터 격리

- `notifications` 테이블은 브라우저 역할에 직접 공개하지 않는다.
- 조회·읽음 처리는 고정 SECURITY DEFINER RPC로만 수행한다.
- 모든 RPC는 `auth.uid()`를 수신자로 강제한다.
- 다른 사용자의 알림 ID를 전달해도 조회·수정할 수 없다.

### 3.2 증거 기반 이벤트 생성

기존 핵심 함수를 반복해서 덮어쓰지 않고 append-only 또는 명확한 생성 지점에 트리거를 연결한다.

- 답글: `comments` AFTER INSERT
- 수동 댓글 Moderation 변경: `moderation_reviews` AFTER INSERT
- 신고 처리·작성자 경고: `comment_report_decisions` AFTER INSERT

이 구조는 P1-2.4/P1-2.5 핵심 함수 계약과 알림 projection을 분리한다.

### 3.3 원자성과 일관성

알림 행은 원본 업무 트랜잭션 안에서 생성한다.

- 답글 저장과 답글 알림이 함께 커밋된다.
- Moderation 감사 기록과 상태 변경 알림이 함께 커밋된다.
- 신고 decision과 신고 결과·경고 알림이 함께 커밋된다.

알림 생성은 `ON CONFLICT DO NOTHING`을 사용하는 idempotent helper로 수행한다. 예상 가능한 재실행은 핵심 업무를 실패시키지 않으며, 예기치 않은 스키마·권한 오류는 전체 트랜잭션을 실패시켜 상태 불일치를 방지한다.

### 3.4 최소 payload

알림에는 댓글 본문, 신고 상세 사유, 관리자 메모를 복제하지 않는다.

저장 항목:

- 이벤트 종류
- 수신자
- 선택적 actor
- 관련 댓글·랭킹·아이템
- 신고 decision
- 상태 값
- deduplication key
- 생성·읽음 시각

표시 문구와 링크는 조회 RPC에서 허용된 상태 값과 현재 공개 대상 정보를 사용해 생성한다.

## 4. 이벤트 종류

| event_type | 수신자 | 생성 근거 | event_value |
|---|---|---|---|
| `comment_reply` | 부모 댓글 작성자 | 공개 가능한 답글 INSERT | NULL |
| `comment_moderation_changed` | 댓글 작성자 | manual moderation review + 상태 변경 | `clean`, `suggestive`, `needs_review`, `blocked` |
| `comment_report_resolved` | pending 신고자 | comment report decision | `dismissed`, `kept`, `hidden`, `blocked` |
| `comment_author_warning` | 댓글 작성자 | decision의 `author_action=warning` | `warning` |

정책:

- 본인이 자신의 댓글에 답글을 작성한 경우 알림을 생성하지 않는다.
- 자동 Moderation create/edit 결과는 요청 화면에서 즉시 반환되므로 별도 알림을 생성하지 않는다.
- 동일 상태에 메모만 추가한 manual review는 Moderation 변경 알림을 생성하지 않는다.
- 탈퇴하여 `reporter_id`가 NULL인 신고에는 결과 알림을 생성하지 않는다.

## 5. 데이터 모델

### 5.1 `notifications`

| 컬럼 | 의미 |
|---|---|
| `id` | 알림 UUID |
| `recipient_id` | 수신 사용자 |
| `event_type` | 알림 유형 |
| `actor_id` | 답글 작성자 등 선택적 행위자 |
| `comment_id` | 관련 댓글 또는 답글 |
| `ranking_id` | 관련 랭킹 |
| `item_id` | 관련 아이템 |
| `report_decision_id` | 신고 처리 decision |
| `event_value` | Moderation 또는 신고 처리 상태 |
| `dedupe_key` | 이벤트별 영구 중복 방지 키 |
| `read_at` | 읽음 처리 시각 |
| `created_at` | 생성 시각 |

FK 정책:

- 수신자 탈퇴: 알림 CASCADE 삭제
- actor 탈퇴: NULL 처리
- 댓글·랭킹·아이템 hard delete: NULL 처리하여 안전한 fallback 허용
- 신고 decision: RESTRICT로 감사 연결 보존

인덱스:

- 수신자별 최신순 목록
- 수신자별 unread partial index
- unique `dedupe_key`

## 6. 중복 방지 키

- 답글: `comment-reply:{reply_id}`
- Moderation 변경: `comment-moderation:{moderation_review_id}`
- 신고 결과: `comment-report-resolution:{decision_id}:{recipient_id}`
- 작성자 경고: `comment-author-warning:{decision_id}:{recipient_id}`

키는 사용자 입력을 포함하지 않고 서버에서만 생성한다.

## 7. RPC 계약

### 7.1 `list_my_notifications`

입력:

- `p_cursor_created_at`
- `p_cursor_id`
- `p_limit` 1~50

반환:

- 알림 ID
- 유형과 상태 값
- 서버 생성 표시 문구
- 안전한 내부 링크 또는 NULL
- actor 표시 이름·아바타
- 생성·읽음 시각

정렬:

- `created_at DESC, id DESC`
- limit+1 기반 keyset pagination

### 7.2 `get_my_unread_notification_count`

현재 사용자의 `read_at IS NULL` 알림 수를 반환한다.

### 7.3 `mark_notification_read`

- 현재 사용자의 지정 알림만 갱신한다.
- 이미 읽은 알림은 기존 `read_at`을 유지한다.
- 타인 알림 또는 없는 ID는 `P0002`.

### 7.4 `mark_all_notifications_read`

현재 사용자의 unread 알림을 한 번에 읽음 처리하고 변경 건수를 반환한다.

### 7.5 `prune_expired_notifications`

service role 전용 retention RPC.

- 읽은 알림: 90일 후 삭제
- 읽지 않은 알림: 180일 후 삭제

## 8. UI

### 8.1 Navbar

- 로그인 사용자에게 Bell 링크 표시
- unread가 있으면 `1~99`, 100 이상은 `99+`
- 카운트 조회 실패 시 Navbar 전체를 실패시키지 않고 배지를 생략

### 8.2 `/me/notifications`

- 최신순 알림 목록
- unread 강조
- 개별 읽음 처리
- 전체 읽음 처리
- 더 보기 pagination
- 링크가 없는 알림은 안전한 텍스트 카드로 유지
- 빈 목록과 오류 상태 제공

### 8.3 댓글 anchor

공개 댓글 article에 `comment-{uuid}` anchor를 부여하여 알림 링크가 해당 댓글로 이동할 수 있게 한다.

## 9. 위협 모델

- 타인 알림 ID를 이용한 읽음 처리
- direct table SELECT/UPDATE
- 클라이언트가 recipient·event_type·dedupe_key 조작
- 트리거 재실행으로 중복 알림 생성
- 삭제·비공개 콘텐츠 링크 노출
- 신고자 또는 관리자 식별 정보 노출
- 알림 메시지에 댓글 본문·신고 상세·관리자 메모 유출
- 대량 unread count로 Navbar 성능 저하

통제:

- RPC 내부 `auth.uid()` 강제
- 테이블 직접 권한 제거
- private trigger/helper만 알림 생성
- unique dedupe key
- 현재 공개 상태 기반 href 생성
- payload 최소화
- recipient unread partial index

## 10. 검증 계획

### DB

- anon RPC 차단
- authenticated direct table 접근 차단
- 타인 알림 읽음 처리 차단
- 답글 생성 시 부모 작성자 알림
- 자기 답글 알림 억제
- manual Moderation 실제 상태 변경 알림
- 동일 상태 메모 review 알림 억제
- 신고 처리 시 모든 유효 신고자에게 결과 알림
- 탈퇴 신고자 제외
- warning 작성자 알림
- trigger 재호출 중복 방지
- 삭제·비공개 대상 href NULL fallback
- unread count와 개별·전체 읽음 처리
- retention 경계
- 테스트 데이터 정리

### 코드

- TypeScript strict build
- ESLint
- Navbar count 표시
- 알림 목록 pagination
- RPC 오류 매핑
- 댓글 anchor
- direct notification mutation 부재

## 11. 완료 기준

- 설계·설계 리뷰 문서화
- migration과 hosted DB 상태 일치
- 이벤트별 Hosted 스모크 테스트 통과
- lint/build exact-head CI 성공
- PR 생성
- 사용자 승인 전 병합 금지
