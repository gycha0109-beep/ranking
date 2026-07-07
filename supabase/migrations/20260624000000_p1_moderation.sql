-- 1. moderation_terms 테이블 생성
CREATE TABLE IF NOT EXISTS public.moderation_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    term TEXT NOT NULL UNIQUE,
    severity TEXT NOT NULL CHECK (severity IN ('allow', 'review', 'block')),
    category TEXT NOT NULL CHECK (category IN ('sexual_suggestive', 'explicit_sexual', 'minor_sexualization', 'real_person_sexualization', 'hate', 'violence', 'privacy', 'illegal', 'spam', 'none')),
    note TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. moderation_terms RLS 활성화 및 정책 추가
ALTER TABLE public.moderation_terms ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (안전망)
DROP POLICY IF EXISTS "Moderation terms viewable by everyone" ON public.moderation_terms;
DROP POLICY IF EXISTS "Moderation terms manageable by admin" ON public.moderation_terms;

CREATE POLICY "Moderation terms viewable by everyone" 
ON public.moderation_terms FOR SELECT USING (true);

CREATE POLICY "Moderation terms manageable by admin" 
ON public.moderation_terms FOR ALL USING (public.is_admin());

-- 3. 기존 테이블에 moderation 컬럼 추가
-- rankings
ALTER TABLE public.rankings 
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'clean' CHECK (moderation_status IN ('clean', 'suggestive', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS moderation_reason TEXT NOT NULL DEFAULT 'none' CHECK (moderation_reason IN ('sexual_suggestive', 'explicit_sexual', 'minor_sexualization', 'real_person_sexualization', 'hate', 'violence', 'privacy', 'illegal', 'spam', 'none')),
ADD COLUMN IF NOT EXISTS image_moderation_status TEXT NOT NULL DEFAULT 'clean' CHECK (image_moderation_status IN ('clean', 'suggestive', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS image_moderation_reason TEXT NOT NULL DEFAULT 'none' CHECK (image_moderation_reason IN ('sexual_suggestive', 'explicit_sexual', 'minor_sexualization', 'real_person_sexualization', 'hate', 'violence', 'privacy', 'illegal', 'spam', 'none'));

-- items
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'clean' CHECK (moderation_status IN ('clean', 'suggestive', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS moderation_reason TEXT NOT NULL DEFAULT 'none' CHECK (moderation_reason IN ('sexual_suggestive', 'explicit_sexual', 'minor_sexualization', 'real_person_sexualization', 'hate', 'violence', 'privacy', 'illegal', 'spam', 'none')),
ADD COLUMN IF NOT EXISTS image_moderation_status TEXT NOT NULL DEFAULT 'clean' CHECK (image_moderation_status IN ('clean', 'suggestive', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS image_moderation_reason TEXT NOT NULL DEFAULT 'none' CHECK (image_moderation_reason IN ('sexual_suggestive', 'explicit_sexual', 'minor_sexualization', 'real_person_sexualization', 'hate', 'violence', 'privacy', 'illegal', 'spam', 'none'));

-- ranking_entries
ALTER TABLE public.ranking_entries 
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'clean' CHECK (moderation_status IN ('clean', 'suggestive', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS moderation_reason TEXT NOT NULL DEFAULT 'none' CHECK (moderation_reason IN ('sexual_suggestive', 'explicit_sexual', 'minor_sexualization', 'real_person_sexualization', 'hate', 'violence', 'privacy', 'illegal', 'spam', 'none'));

-- comments
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'clean' CHECK (moderation_status IN ('clean', 'suggestive', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS moderation_reason TEXT NOT NULL DEFAULT 'none' CHECK (moderation_reason IN ('sexual_suggestive', 'explicit_sexual', 'minor_sexualization', 'real_person_sexualization', 'hate', 'violence', 'privacy', 'illegal', 'spam', 'none'));

-- 4. 기본 moderation_terms 시드 데이터 주입
INSERT INTO public.moderation_terms (term, severity, category, note) VALUES
('불법촬영', 'block', 'illegal', '불법촬영 및 유포물 차단'),
('딥페이크', 'block', 'illegal', '딥페이크 성착취물 차단'),
('아청', 'block', 'minor_sexualization', '미성년 성적 대상화 차단'),
('섹스동영상', 'block', 'explicit_sexual', '노골적 성행위 영상 차단'),
('마약구매', 'block', 'illegal', '마약 유통 등 불법 행위 차단'),
('자살방법', 'block', 'violence', '극단적 선택 부추김 차단'),
('porno', 'block', 'explicit_sexual', '음란물 차단'),
('섹시', 'review', 'sexual_suggestive', '선정성 검토'),
('자살', 'review', 'violence', '폭력성/자해 검토'),
('칼침', 'review', 'violence', '강력 폭력어 검토'),
('살해', 'review', 'violence', '강력 폭력어 검토'),
('성인물', 'review', 'sexual_suggestive', '선정성 검토'),
('로리', 'review', 'minor_sexualization', '소아 성애적 표현 검토'),
('매력', 'allow', 'none', '허용어'),
('인기', 'allow', 'none', '허용어'),
('성인', 'allow', 'none', '허용어')
ON CONFLICT (term) DO NOTHING;
