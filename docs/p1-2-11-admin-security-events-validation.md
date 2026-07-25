# P1-2.11 Hosted 검증

## 적용

- Supabase Hosted migration `p1_2_11_admin_security_events` 적용 성공
- 운영 보안 이벤트 테이블, 집계 기록 RPC, 조회 RPC, overview RPC, 90일 정리 작업 생성 확인

## 검증 결과

### 권한·노출

- 최고 관리자 `security_event_view`: true
- authenticated의 private recorder 실행 권한: false
- anon의 public recorder 실행 권한: false
- authenticated의 public recorder 실행 권한: true
- authenticated의 원본 테이블 SELECT 권한: false
- public 목록·overview는 DB에서 최고 관리자 capability 재검사

### 집계

- 동일 행위자·종류·action·resource·failure·route·subject type을 같은 5분 버킷에서 2회 기록
- 단일 버킷 유지
- `occurrence_count = 2`
- overview의 `total_occurrences = 2`, `total_buckets = 1`

### 입력 검증

다음 입력이 SQLSTATE `22023`으로 거부됨을 트랜잭션에서 확인했다.

- 공백이 포함된 action key
- UUID/BIGINT가 아닌 subject reference
- 허용 목록 밖 event kind
- timestamp만 있는 부분 cursor

### 페이지네이션

임시 버킷 4개를 트랜잭션에서 생성해 2건씩 keyset 조회했다.

- page 1: 2건
- page 2: 2건
- 중복 ID: 0건

### 유지보수

- `ranking-maint-prune-admin-security-events` cron 등록 및 active 상태 확인
- 보존정책: `last_seen_at` 기준 90일
- 배치 크기 5,000, 최대 10배치, timeout 30초

### 데이터 정리

모든 fixture는 트랜잭션 rollback으로 제거했다. Hosted에 검증용 보안 이벤트를 영구 저장하지 않았다.
