# 랭킹위키 MVP (P0-Core)

이 프로젝트는 랭킹위키의 핵심 가치인 **관리자 랭킹 문서 발행 루프(P0-Core)**를 실제로 작동하고 검증하기 위한 Next.js 기반 MVP 애플리케이션입니다.

---

## 🚀 시작하기

### 1. 환경 변수 설정
프로젝트 루트 디렉터리에 `.env.local` 파일을 생성하고 아래 내용을 입력해 주세요.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 개발 환경 전용 첫 관리자 자동 승격용 이메일
ADMIN_BOOTSTRAP_EMAIL=admin@rankingwiki.com
```

> [!WARNING]
> `ADMIN_BOOTSTRAP_EMAIL`을 사용한 임의 자동 승격은 개발(development) 환경에서만 허용됩니다. 운영(production) 환경에서는 외부 침입을 예방하기 위해 이 기능이 완벽히 차단됩니다.

### 2. 데이터베이스 스키마 적용
[supabase/migrations/20260520000000_p0_core_schema.sql](file:///D:/Ji_hwan/Ranking_wiki/supabase/migrations/20260520000000_p0_core_schema.sql) 파일의 전체 내용을 Supabase Console의 **SQL Editor**에 복사-붙여넣기하여 실행해 주시면 데이터베이스 테이블, 제약조건, 트리거 및 RLS 보안 정책이 일괄 적용됩니다.

### 3. 패키지 설치 및 실행
```bash
# 의존성 설치
npm install

# 로컬 개발 서버 시작
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속할 수 있습니다.

---

## 🔐 첫 관리자(Admin) 권한 지정 방법

어플리케이션은 관리자 권한(`user_roles` 테이블의 `role = 'admin'`)을 검증하여 `/admin` 경로를 강력하게 보호합니다. 첫 관리자를 지정하는 방법은 두 가지가 있습니다.

### 방법 A: Supabase SQL Editor를 통한 수동 추가 (운영 권한 확보 시)
계정을 생성(가입)한 후, Supabase SQL Editor에서 해당 사용자의 `id` 값을 찾아 아래의 SQL 쿼리를 실행해 주십시오.

```sql
-- 1. display_name 등으로 가입된 사용자의 id 조회
SELECT id, email, display_name FROM public.profiles;

-- 2. 해당 id를 가진 사용자를 admin으로 승격
INSERT INTO public.user_roles (user_id, role)
VALUES ('조회된_사용자_UUID_값', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

### 방법 B: `ADMIN_BOOTSTRAP_EMAIL` 자동 부트스트랩 (로컬 개발 환경 전용)
1. `.env.local` 파일에 `ADMIN_BOOTSTRAP_EMAIL=admin@rankingwiki.com`을 등록합니다.
2. 개발 환경(`npm run dev`)에서 `/login` 페이지를 통해 해당 이메일로 회원가입 및 로그인을 수행합니다.
3. 로그인 서버 액션 실행 시, 시스템이 개발 환경임을 식별하고 `user_roles` 테이블에 `admin` 역할을 우회 트리거(Service Role)를 사용해 자동으로 주입합니다.

---

## 📂 구현 범위 (P0-Core)

### 포함된 핵심 기능
- **관리자 랭킹 작성 CMS**: 카테고리, 서브카테고리, Facet, 아이템의 CRUD를 통제하며 드래프트 랭킹 생성.
- **선정 기준 & Scope 에어리어**: 랭킹에 대상 후보군(Scope) 및 명확한 선정 기준(weight 포함)을 유연하게 등록.
- **랭킹 엔트리 구성**: 순위별 아이템 등록, 순위 중복 및 아이템 중복 방지 제약조건 하에서의 선정 이유 기술.
- **E2E 발행 루프**: `/admin/rankings/[id]/preview`에서 필수값 및 카테고리-서브카테고리 정합성을 서버 측에서 최종 검사 후 `published` 상태로 발행.
- **프리미엄 HSL 다크모드/글래스모피즘**: 사용자에게 하모니어스 다크 디자인을 선사하는 시각적 완성도 제공.

### 제외된 기능 (P1/P2 범위 - TODO 주석 처리)
- 검색 페이지, 반응 버튼, 댓글 작성/관리, 유저 투표, 스폰서 광고 판매 관리, 크롤러 및 자동 수집 파이프라인, 변경 이력 UI, 결제
