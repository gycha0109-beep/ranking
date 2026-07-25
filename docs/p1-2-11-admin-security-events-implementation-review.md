# P1-2.11 구현 리뷰

## 결론

운영 성공 원장과 분리된 실패 텔레메트리, 5분 집계, 최고 관리자 전용 조회, 90일 보존정책이 설계 계약에 맞게 구현됐다.

## 리뷰 결과

### 1. 트랜잭션 롤백과 실패 기록

실패한 원본 RPC 내부에서 로그를 쓰면 원본 예외와 함께 롤백된다. 애플리케이션이 RPC 응답을 받은 뒤 별도 `record_admin_security_event` RPC를 호출하는 방식으로 분리했다. 기록 실패는 원래 오류를 덮지 않는다.

### 2. 신뢰 경계

기록 RPC는 `auth.uid()`를 행위자로 강제하여 다른 사용자를 사칭할 수 없다. 다만 이벤트 종류와 식별자는 인증 사용자의 self-report이므로 원장에는 `authenticated_self_report`를 명시한다. 외부 WAF·gateway 로그와 동일한 강도의 탐지 자료로 취급하지 않는다.

### 3. 민감정보 최소화

자유서술 입력과 오류 메시지는 저장하지 않는다. action/resource/failure/route는 제한된 식별자 형식이며 subject reference는 UUID, BIGINT 또는 `none`만 허용한다.

### 4. 로그 증폭 방지

동일 사건은 5분 버킷에서 count로 압축한다. 행위자별 시간당 60개를 초과하는 신규 버킷은 `event_overflow`로 합친다. advisory lock으로 동시 삽입 시 한도를 우회하지 못하게 한다.

### 5. 권한 분리

`security_event_view`는 최고 관리자에게만 부여된다. 테이블과 private 함수는 anon/authenticated에서 직접 접근할 수 없고 public 조회 RPC가 DB capability를 재검사한다.

### 6. 서버 액션 제약

`use server` 파일에서 runtime 상수를 내보내면 Next.js 빌드가 실패할 수 있어 상수·타입을 `src/lib/admin-security-events.ts`로 분리했다. server action 파일은 async 함수만 export한다.

### 7. 조회 안정성

목록은 `(last_seen_at DESC, id DESC)` keyset pagination을 사용한다. 이벤트 종류, 위험도, 행위자, action, 기간, 최소 횟수는 DB와 애플리케이션 양쪽에서 검증한다.

### 8. 유지보수 연계

기존 bounded maintenance runner에 `prune_admin_security_events` 분기를 추가했다. 90일이 지난 버킷을 5,000건 단위, 최대 10배치로 삭제하며 매일 04:00 cron으로 등록한다.

## 보완 반영

- 공통 capability 거부 계측
- 역할 관리·감사 조회 RPC 실패 계측
- 보안 이벤트 전용 최고 관리자 화면
- raw input 비저장
- server action runtime export 분리
- keyset cursor 검증
- 집계·overflow 보호

## 잔여 리스크

각 운영 도메인의 애플리케이션 선검증 실패를 100% 포착하려면 신규 관리자 mutation을 추가할 때 공통 `runAdminRpc` 또는 명시적 reporter를 사용해야 한다. 이 규칙은 후속 구현 체크리스트에 유지한다.
