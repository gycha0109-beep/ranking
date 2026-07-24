# P1-2.10 최종 리뷰·PR 게이트

## 완료 범위

- 설계, 독립 설계 리뷰, 최종 계약 보완
- 기존 append-only 원장 기반 정규화 stream
- root correlation과 하위 group ID
- event kind, actor, subject, correlation, 기간 필터
- keyset pagination
- 목록의 자유서술 운영 메모 제거
- 최고 관리자 전용 민감 근거 capability
- 감사 이벤트 상세·관련 사건 탐색 화면
- Hosted migration 및 권한·cursor·입력 검증

## 최종 자체 리뷰

### 데이터 무결성

- 범용 audit write table을 추가하지 않았다.
- 원본 역할 변경, Moderation, 신고 결정, 제재, 이의제기, 유지보수 원장이 authoritative source다.
- 조회 계층은 원본 행을 수정하거나 삭제하지 않는다.

### 보안

- 목록과 related events는 최소 summary만 반환한다.
- 자유서술 사유·검토 메모·이의제기 본문·확장 metadata·maintenance details와 error message는 최고 관리자 상세에만 반환한다.
- private stream은 anon/authenticated execute 불가다.
- public RPC는 authenticated execute가 가능하지만 `audit_view` capability를 DB에서 재검사한다.
- 상세의 민감 정보 여부는 caller input이 아니라 DB capability로 결정한다.

### 조회 안정성

- 정렬과 cursor가 `created_at DESC, sort_key DESC`로 일치한다.
- sort key는 event kind와 source PK를 포함한다.
- filter와 cursor는 DB와 서버 액션 양쪽에서 검증한다.
- correlation은 exact match이며 wildcard 검색을 제공하지 않는다.

### 호환성

- 기존 `list_admin_audit_events(INTEGER, INTEGER)` signature를 유지했다.
- 기존 `/admin/audit` 경로를 그대로 개선했다.
- middleware의 `/admin/audit` prefix capability 보호가 상세 하위 경로에도 적용된다.

## 잔여 제한

- Hosted에 현재 댓글 신고 결정 행이 없어 해당 event kind의 실제 행 반환은 기존 schema·정규화 branch 정적 검토로만 확인됐다.
- 과거 표시 이름 snapshot은 없으며 UUID가 authoritative 식별자다.
- 실패한 운영 요청 감사와 외부 SIEM 전송은 별도 단계다.
- 원장 규모가 작아 actor·subject 복합 인덱스는 추가하지 않았다.

## PR 게이트

1. branch가 최신 main에서 분기했는지 재확인
2. 변경 파일과 migration 순서 검토
3. PR 생성
4. PR exact-head GitHub Actions lint/build 성공 확인
5. 실패 시 해당 head를 보완하고 재검증
6. 사용자 명시적 승인 전 병합 금지
