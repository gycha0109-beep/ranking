-- 랭킹위키 P0-Core 스키마 마이그레이션 v0.1

-- 0. 확장 설치 및 기본 설정
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. profiles 테이블 생성
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. user_roles 테이블 생성 (역할 관리)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- 3. categories 테이블 생성 (상위 카테고리)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. subcategories 테이블 생성 (서브 카테고리)
CREATE TABLE IF NOT EXISTS public.subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category_id, slug)
);

-- 5. facet_groups 테이블 생성
CREATE TABLE IF NOT EXISTS public.facet_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    applies_to TEXT CHECK (applies_to IN ('ranking', 'item', 'both')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. facets 테이블 생성
CREATE TABLE IF NOT EXISTS public.facets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facet_group_id UUID NOT NULL REFERENCES public.facet_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(facet_group_id, slug)
);

-- 7. items 테이블 생성 (아이템 리스트)
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    item_type TEXT NOT NULL,
    image_url TEXT,
    brand_or_creator TEXT,
    external_url TEXT,
    affiliate_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'archived')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. item_facets 연결 테이블 생성
CREATE TABLE IF NOT EXISTS public.item_facets (
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    facet_id UUID NOT NULL REFERENCES public.facets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (item_id, facet_id)
);

-- 9. rankings 테이블 생성 (랭킹 핵심 문서)
CREATE TABLE IF NOT EXISTS public.rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    summary TEXT NOT NULL,
    body TEXT,
    ranking_type TEXT NOT NULL CHECK (ranking_type IN ('editor_pick', 'popularity', 'quality', 'purpose', 'user_vote', 'sponsored')),
    scope_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    cover_image_url TEXT,
    seo_title TEXT,
    seo_description TEXT,
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. ranking_entries 테이블 생성 (랭킹 내부 순위 항목)
CREATE TABLE IF NOT EXISTS public.ranking_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ranking_id UUID NOT NULL REFERENCES public.rankings(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position > 0),
    reason TEXT NOT NULL,
    editor_score NUMERIC,
    score_json JSONB DEFAULT '{}'::jsonb,
    internal_note TEXT,
    sponsor_flag BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ranking_id, position),
    UNIQUE(ranking_id, item_id)
);

-- 11. ranking_facets 연결 테이블 생성
CREATE TABLE IF NOT EXISTS public.ranking_facets (
    ranking_id UUID NOT NULL REFERENCES public.rankings(id) ON DELETE CASCADE,
    facet_id UUID NOT NULL REFERENCES public.facets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ranking_id, facet_id)
);

-- 12. ranking_criteria 테이블 생성 (선정 기준)
CREATE TABLE IF NOT EXISTS public.ranking_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ranking_id UUID NOT NULL REFERENCES public.rankings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    weight NUMERIC,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. ranking_sources 테이블 생성 (출처 정보)
CREATE TABLE IF NOT EXISTS public.ranking_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ranking_id UUID NOT NULL REFERENCES public.rankings(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    url TEXT,
    source_type TEXT,
    note TEXT,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. P1 테이블 생성 (테이블 구조 선언만 허용, 기능 구현 제외)
CREATE TABLE IF NOT EXISTS public.reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ranking_id UUID NOT NULL REFERENCES public.rankings(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, ranking_id, reaction_type)
);

CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
      (ranking_id IS NOT NULL AND item_id IS NULL)
      OR
      (ranking_id IS NULL AND item_id IS NOT NULL)
    )
);

-- =========================================================================
-- TRIGGER & FUNCTIONS
-- =========================================================================

-- A. 카테고리/서브카테고리 정합성 보장 트리거
CREATE OR REPLACE FUNCTION check_ranking_category_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subcategory_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subcategories 
      WHERE id = NEW.subcategory_id AND category_id = NEW.category_id
    ) THEN
      RAISE EXCEPTION 'Subcategory category_id must match ranking category_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_ranking_category_consistency
BEFORE INSERT OR UPDATE ON public.rankings
FOR EACH ROW
EXECUTE FUNCTION check_ranking_category_consistency();

-- B. auth.users 생성 시 profile 자동 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- C. updated_at 자동 갱신을 위한 공용 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 연결
CREATE TRIGGER trg_update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_subcategories_updated_at BEFORE UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_facet_groups_updated_at BEFORE UPDATE ON public.facet_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_facets_updated_at BEFORE UPDATE ON public.facets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_rankings_updated_at BEFORE UPDATE ON public.rankings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_ranking_entries_updated_at BEFORE UPDATE ON public.ranking_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_ranking_criteria_updated_at BEFORE UPDATE ON public.ranking_criteria FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facet_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_facets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_facets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 헬퍼 함수: 현재 사용자가 어드민인지 여부 확인
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. profiles RLS
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. user_roles RLS (어드민만 읽기/수정 가능)
CREATE POLICY "Roles viewable by admin" ON public.user_roles FOR SELECT USING (public.is_admin() OR auth.uid() = user_id);
CREATE POLICY "Roles manageable by admin only" ON public.user_roles FOR ALL USING (public.is_admin());

-- 3. categories RLS
CREATE POLICY "Categories viewable by everyone if visible" ON public.categories FOR SELECT USING (is_visible = true OR public.is_admin());
CREATE POLICY "Categories manageable by admin only" ON public.categories FOR ALL USING (public.is_admin());

-- 4. subcategories RLS
CREATE POLICY "Subcategories viewable by everyone if visible" ON public.subcategories FOR SELECT USING (is_visible = true OR public.is_admin());
CREATE POLICY "Subcategories manageable by admin only" ON public.subcategories FOR ALL USING (public.is_admin());

-- 5. facet_groups RLS
CREATE POLICY "Facet groups viewable by everyone" ON public.facet_groups FOR SELECT USING (true);
CREATE POLICY "Facet groups manageable by admin" ON public.facet_groups FOR ALL USING (public.is_admin());

-- 6. facets RLS
CREATE POLICY "Facets viewable by everyone" ON public.facets FOR SELECT USING (true);
CREATE POLICY "Facets manageable by admin" ON public.facets FOR ALL USING (public.is_admin());

-- 7. items RLS
CREATE POLICY "Items viewable by everyone if active" ON public.items FOR SELECT USING (status = 'active' OR public.is_admin());
CREATE POLICY "Items manageable by admin" ON public.items FOR ALL USING (public.is_admin());

-- 8. item_facets RLS
CREATE POLICY "Item facets viewable by everyone" ON public.item_facets FOR SELECT USING (true);
CREATE POLICY "Item facets manageable by admin" ON public.item_facets FOR ALL USING (public.is_admin());

-- 9. rankings RLS (P0 핵심)
-- Published 상태는 누구나 조회 가능, draft/archived 상태는 오직 어드민만 조회 가능
CREATE POLICY "Rankings select policy" ON public.rankings FOR SELECT USING (
  status = 'published' OR public.is_admin()
);
CREATE POLICY "Rankings manageable by admin" ON public.rankings FOR ALL USING (public.is_admin());

-- 10. ranking_entries RLS
CREATE POLICY "Ranking entries select policy" ON public.ranking_entries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.rankings r
    WHERE r.id = ranking_id AND (r.status = 'published' OR public.is_admin())
  )
);
CREATE POLICY "Ranking entries manageable by admin" ON public.ranking_entries FOR ALL USING (public.is_admin());

-- 11. ranking_facets RLS
CREATE POLICY "Ranking facets select policy" ON public.ranking_facets FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.rankings r
    WHERE r.id = ranking_id AND (r.status = 'published' OR public.is_admin())
  )
);
CREATE POLICY "Ranking facets manageable by admin" ON public.ranking_facets FOR ALL USING (public.is_admin());

-- 12. ranking_criteria RLS
CREATE POLICY "Ranking criteria select policy" ON public.ranking_criteria FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.rankings r
    WHERE r.id = ranking_id AND (r.status = 'published' OR public.is_admin())
  )
);
CREATE POLICY "Ranking criteria manageable by admin" ON public.ranking_criteria FOR ALL USING (public.is_admin());

-- 13. ranking_sources RLS
-- is_public=true 이고 랭킹이 published 이거나, 어드민인 경우에만 select 허용
CREATE POLICY "Ranking sources select policy" ON public.ranking_sources FOR SELECT USING (
  (is_public = true AND EXISTS (
    SELECT 1 FROM public.rankings r
    WHERE r.id = ranking_id AND r.status = 'published'
  )) OR public.is_admin()
);
CREATE POLICY "Ranking sources manageable by admin" ON public.ranking_sources FOR ALL USING (public.is_admin());

-- 14. P1 reactions RLS
CREATE POLICY "Reactions viewable by everyone" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "Reactions manageable by self" ON public.reactions FOR ALL USING (auth.uid() = user_id);

-- 15. P1 comments RLS
CREATE POLICY "Comments viewable if visible" ON public.comments FOR SELECT USING (status = 'visible' OR public.is_admin());
CREATE POLICY "Comments manageable by self" ON public.comments FOR ALL USING (auth.uid() = user_id OR public.is_admin());
