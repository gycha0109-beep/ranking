# P1-2.5 댓글 신고·운영 제재 설계

## 1. 목적

P1-2.4에서 구축한 댓글·1단계 답글·자동/수동 Moderation 위에 사용자 신고와 관리자 처리 절차를 추가한다.

핵심 목표는 다음과 같다.

- 로그인 사용자가 공개 댓글을 신고할 수 있다.
- 본인 댓글 신고, 중복 신고, 신고 도배를 차단한다.
- 신고자 식별 정보는 일반 사용자와 댓글 작성자에게 노출하지 않는다.
- 관리자는 신고 건을 댓글 단위 사건(case)으로 집계하여 검토한다.
- 관리자 조치는 유지, 기각, 숨김, 차단, 작성자 경고를 지원한다.
- 모든 운영 판단은 append-only 감사 기록으로 남긴다.
- 기존 댓글 Moderation과 충돌하지 않고 하나의 트랜잭션에서 처리한다.

## 2. 비범위

- 계정 정지·영구 차단
- 신고자와 피신고자 간 메시징
- 신고 철회
- 관리자 간 사건 배정
- 신고 결과 사용자 알림
- 머신러닝 기반 신고 우선순위 산정

계정 제재와 알림은 후속 단계에서 감사 기록을 입력 데이터로 사용한다.

## 3. 위협 모델

### 3.1 공격 시나리오

- 비로그인 사용자의 신고 RPC 호출
- 본인 댓글을 신고하여 신고 수 조작
- 동일 계정의 동일 댓글 반복 신고
- 짧은 시간에 다수 댓글을 신고하는 신고 도배
- 이미 삭제되거나 비공개된 댓글 신고
- 클라이언트가 다른 콘텐츠의 댓글 ID를 주입
- 일반 사용자가 신고 테이블 또는 신고자 ID 직접 조회
- 관리자 검토 중 신규 신고가 들어와 사건 스냅샷이 어긋나는 경쟁 조건
- 관리자가 오래된 화면에서 중복 처리
- 신고 처리와 댓글 Moderation 상태 변경이 부분 성공하는 원자성 손상

### 3.2 통제 원칙

- 테이블 직접 접근 금지, 고정 SECURITY DEFINER RPC만 허용
- 모든 사용자 ID는 `auth.uid()`에서만 취득
- 댓글 ID와 랭킹/아이템 대상 ID를 DB에서 교차 검증
- 댓글별 사건 advisory lock과 신고자별 rate-limit lock 사용
- 동일 `(comment_id, reporter_id)` 영구 유일성
- 사건 처리 시 `expected_pending_count` 낙관적 동시성 검증
- 신고 처리와 Moderation 변경 및 감사 로그를 단일 트랜잭션으로 실행

## 4. 데이터 모델

### 4.1 `comment_reports`

사용자 신고 원본을 보관한다.

| 컬럼 | 의미 |
|---|---|
| `id` | 신고 UUID |
| `comment_id` | 신고 대상 댓글 |
| `reporter_id` | 신고 사용자. 탈퇴 시 NULL 처리 |
| `reason` | 신고 사유 |
| `details` | 선택 입력 상세 사유, 최대 500자 |
| `status` | `pending`, `resolved`, `dismissed` |
| `created_at` | 신고 시각 |
| `resolved_at` | 처리 시각 |
| `resolved_by` | 처리 관리자 |
| `decision_id` | 처리 감사 기록 연결 |

허용 신고 사유:

- `spam`
- `harassment`
- `hate`
- `sexual`
- `violence`
- `privacy`
- `illegal`
- `misinformation`
- `other`

제약:

- 동일 신고자와 동일 댓글은 1건만 허용한다.
- `details`는 정규화 후 500자 이하이다.
- pending 상태에서는 처리 컬럼이 NULL이어야 한다.
- resolved/dismissed 상태에서는 처리 시각과 decision이 필요하다.

### 4.2 `comment_report_decisions`

관리자 사건 처리 기록을 append-only로 보관한다.

| 컬럼 | 의미 |
|---|---|
| `id` | BIGINT identity |
| `comment_id` | 처리 대상 댓글 |
| `reviewed_by` | 관리자 |
| `pending_count_snapshot` | 처리 당시 pending 신고 수 |
| `resolution` | `dismissed`, `kept`, `hidden`, `blocked` |
| `author_action` | `none`, `warning` |
| `decision_reason` | 기존 Moderation 사유 체계 |
| `review_note` | 관리자 메모 |
| `created_at` | 처리 시각 |

`hidden`은 댓글 Moderation 상태를 `needs_review`로 전환하고, `blocked`는 `blocked`로 전환한다. `kept`와 `dismissed`는 댓글 공개 상태를 변경하지 않는다.

`warning`은 즉시 계정 권한을 변경하지 않는다. 후속 계정 제재 시스템이 경고 누적을 조회할 수 있는 감사 이벤트다.

## 5. 권한 모델

### 5.1 일반 사용자

허용:

- 공개 상태의 타인 댓글 신고
- 댓글 목록에서 본인의 신고 완료 여부 확인

금지:

- 신고 테이블 직접 SELECT/INSERT/UPDATE/DELETE
- 신고자 목록 조회
- 신고 상세 처리 상태 조회
- 본인 댓글 신고
- 삭제·숨김·차단 댓글 신고

### 5.2 관리자

허용:

- pending 사건 집계 조회
- 신고 사유별 집계와 익명화된 상세 사유 조회
- 사건 처리
- 댓글 Moderation 및 작성자 경고 결정
- 과거 사건 처리 감사 기록 조회

관리자 대기열에도 신고자 ID, 이메일, 표시 이름은 반환하지 않는다.

## 6. RPC 설계

### 6.1 `report_content_comment`

입력:

- 댓글 ID
- 기대 랭킹 ID 또는 아이템 ID 중 하나
- 신고 사유
- 상세 사유

검증 순서:

1. 로그인 확인
2. 입력 정규화와 길이 검증
3. 신고자 rate-limit advisory lock
4. 댓글 사건 advisory lock
5. 댓글과 기대 콘텐츠 대상 일치 검증
6. 댓글 공개 상태 검증
7. 본인 댓글 여부 검증
8. 중복 신고 검증
9. 신고 삽입

Rate limit:

- 시간당 최대 5건
- 24시간 최대 15건

반환:

- `report_id`
- `status`
- `created_at`

### 6.2 `get_my_reported_comment_ids`

현재 페이지에 포함된 댓글 ID 배열을 받아 본인이 이미 신고한 댓글 ID만 반환한다.

- authenticated 전용
- 신고 상태와 무관하게 과거 신고가 있으면 신고 완료로 표시
- 타인의 신고 여부는 반환하지 않음

### 6.3 `list_comment_report_queue`

관리자 전용 사건 집계.

댓글 단위로 반환:

- 댓글 원문 및 Moderation 상태
- 작성자 표시 이름
- 콘텐츠 종류, ID, slug, 제목
- pending 신고 수
- 신고 사유별 개수
- 익명화된 최근 상세 사유 샘플
- 최초·최근 신고 시각
- 기존 작성자 경고 누적 수

### 6.4 `review_comment_report_case`

입력:

- 댓글 ID
- 화면에서 본 pending 신고 수
- resolution
- author action
- Moderation reason
- 관리자 메모

처리:

1. 관리자 확인
2. 댓글 사건 advisory lock
3. 댓글과 pending 신고 행 잠금
4. 현재 pending 수와 기대 수 비교
5. 숨김/차단이면 기존 `private.apply_moderation_review` 호출
6. 사건 decision append-only 삽입
7. pending 신고를 resolved 또는 dismissed로 일괄 전환
8. 결과 반환

경쟁 조건이 감지되면 SQLSTATE `40001`로 재조회 요구.

### 6.5 `get_pending_comment_report_case_count`

관리자 대시보드용 pending 댓글 사건 수를 반환한다. 신고 행 수가 아니라 distinct 댓글 수이다.

## 7. UI 설계

### 7.1 공개 댓글 UI

타인의 공개 댓글에 `신고` 버튼을 표시한다.

- 비로그인 클릭: 로그인 화면 이동
- 신고 완료 댓글: `신고됨` 비활성 표시
- 신고 패널:
  - 사유 선택
  - 상세 설명 선택 입력
  - 500자 제한
  - 제출·취소
- 성공 후 댓글 목록을 다시 불러 신고 완료 상태 반영

원문은 React text node로만 렌더링하며 HTML 입력은 지원하지 않는다.

### 7.2 관리자 신고 대기열

신규 경로: `/admin/comment-reports`

카드별 표시:

- 댓글 원문과 대상 콘텐츠 링크
- pending 신고 수
- 사유 분포
- 익명화된 상세 사유
- 최초·최근 신고 시각
- 기존 Moderation 상태와 경고 누적

조치:

- 신고 기각
- 댓글 유지
- 댓글 숨김
- 댓글 차단
- 작성자 경고 체크
- Moderation 사유 선택
- 관리자 메모

처리 후 대기열을 새로 불러온다.

## 8. 오류 계약

| SQLSTATE | 의미 |
|---|---|
| `42501` | 로그인 또는 관리자 권한 부족 |
| `22023` | 잘못된 입력, 본인 신고, 중복 신고 |
| `P0001` | 신고 Rate limit 초과 |
| `P0002` | 댓글 또는 공개 대상 없음 |
| `40001` | 사건 처리 스냅샷 충돌 |

Server Action은 이를 안정적인 사용자 메시지와 코드로 변환한다.

## 9. 검증 계획

### 9.1 DB 검증

- 비로그인 신고 차단
- 정상 타인 댓글 신고
- 본인 댓글 신고 차단
- 동일 사용자 중복 신고 차단
- 대상 랭킹/아이템 불일치 차단
- 숨김·삭제 댓글 신고 차단
- 시간·일 Rate limit
- 일반 사용자 직접 테이블 접근 차단
- 본인 신고 ID 조회와 타인 신고 비노출
- 관리자 대기열 신고자 비식별
- pending 사건 수 정확성
- stale pending count 처리 차단
- 기각·유지·숨김·차단 처리
- 작성자 경고 감사 기록
- Moderation 이력과 report decision 원자적 생성
- 처리 후 pending 대기열 제거
- 테스트 데이터 정리

### 9.2 코드 검증

- TypeScript strict build
- ESLint
- 공개 댓글 신고 UI
- 신고 완료 상태
- 관리자 대기열 파싱
- RPC 오류 매핑
- direct table mutation 부재 검색

## 10. 완료 기준

- 모든 DDL이 migration으로 저장되고 hosted Supabase에 적용됨
- 공개 UI와 관리자 UI가 구현됨
- 설계 리뷰 및 구현 리뷰 보완사항이 문서화됨
- exact-head CI lint/build 성공
- PR 생성 후 사용자 승인 전까지 병합하지 않음
