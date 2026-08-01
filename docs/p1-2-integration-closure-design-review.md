# P1-2 통합 회귀 검증·운영 마감 설계 리뷰

## 결론

기능을 더 추가하기 전에 P1-2 전체를 닫는 방향은 타당하다. 다만 통합 검증이 문서 체크리스트에 그치면 회귀 방지 효과가 낮으므로, 저장소에서 반복 실행 가능한 정적 계약 검증과 Hosted DB의 실제 상태 전이 검증을 분리해야 한다.

## 필수 보완

### 1. 정적 검사와 Hosted 검사의 역할 분리

정적 검사는 migration 누락·중복·보안 키워드·CI 연결을 확인한다. RPC의 실제 권한, auth.uid(), RLS 우회, transaction 원자성은 Hosted에서만 판정한다.

### 2. migration 재현성 표현 제한

현재 CI에서 Docker 기반 전체 Supabase bootstrap을 수행하지 않으므로 “빈 DB 전체 재현 완료”라고 과장하지 않는다. 이번 단계에서는 다음을 보장한다.

- migration 파일 계보의 정적 완전성
- Hosted migration history와 필수 단계 일치
- 신규 migration의 forward-only 적용

빈 DB bootstrap은 별도 local Supabase CI 단계로 확장할 수 있다.

### 3. 필수 marker를 파일명 한 개에 고정하지 않기

각 P1-2 단계가 후속 hardening migration으로 나뉘어 있으므로 prefix 또는 migration 내용 marker 중 하나가 존재하면 통과하게 한다. 단, 단계 전체 누락은 실패한다.

### 4. transaction 검사 예외

일부 기존 migration은 PostgreSQL 확장 또는 cron command 특성상 일반 transaction wrapper와 다를 수 있다. 모든 과거 파일을 일괄 실패시키지 않고 P1-2 핵심 migration에서 `BEGIN`/`COMMIT` 또는 명시적 예외 주석을 요구한다.

### 5. 보안 키워드 검사는 최소 신호

`SECURITY DEFINER`, `REVOKE`, `ENABLE ROW LEVEL SECURITY` 문자열 존재만으로 안전성을 증명하지 않는다. 이 검사는 누락 방지 신호이며 Hosted privilege matrix가 최종 판정이다.

### 6. fixture 안전성

Hosted 상태 전이 테스트는 가능한 경우 transaction rollback을 사용한다. append-only 원장을 생성하는 RPC는 rollback 내부에서만 호출하고, service-role 유지보수 테스트도 기존 운영 데이터가 아닌 임시 과거 데이터만 대상으로 한다.

### 7. 제재 강제 범위

계정 정지는 로그인·제재 조회·이의제기까지 차단하면 안 된다. 검증 대상은 댓글, 신고, 좋아요, 북마크 등 정책상 제한된 mutation이며, 제재 확인과 이의제기는 계속 허용되어야 한다.

### 8. Advisor 경고 처리

Supabase Advisor 경고를 개수로만 성공/실패 처리하지 않는다. 공개 집계 RPC, 인증 사용자용 RPC, 의도적 deny-by-default RLS는 설계상 경고일 수 있다. 신규 Critical/High 결함만 차단하며 기존 의도된 경고는 근거를 문서화한다.

## 최종 실행 순서

1. 정적 계약 스크립트 구현
2. package.json과 CI 연결
3. Hosted schema·migration·privilege matrix 확인
4. rollback 기반 상태 전이 스모크 테스트
5. 발견 결함 보완
6. 구현 리뷰
7. exact-head CI
8. 종료 보고 및 PR 생성
