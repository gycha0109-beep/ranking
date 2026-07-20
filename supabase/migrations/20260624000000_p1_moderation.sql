BEGIN;

CREATE TABLE IF NOT EXISTS public.moderation_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term TEXT NOT NULL UNIQUE,
    severity TEXT NOT NULL CHECK (severity IN ('review', 'block')),
    category TEXT NOT NULL CHECK (category IN (
      'sexual_suggestive',
      'explicit_sexual',
      'minor_sexualization',
      'real_person_sexualization',
      'hate',
      'violence',
      'privacy',
      'illegal',
      'spam',
      'none',
      'system_error'
    )),
    match_mode TEXT NOT NULL DEFAULT 'compact_substring'
      CHECK (match_mode IN ('substring', 'compact_substring')),
    note TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.moderation_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Moderation terms viewable by everyone" ON public.moderation_terms;
DROP POLICY IF EXISTS "Moderation terms viewable by admin" ON public.moderation_terms;
DROP POLICY IF EXISTS "Moderation terms manageable by admin" ON public.moderation_terms;

CREATE POLICY "Moderation terms viewable by admin"
ON public.moderation_terms
FOR SELECT
USING (public.is_admin());

CREATE POLICY "Moderation terms manageable by admin"
ON public.moderation_terms
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_update_moderation_terms_updated_at ON public.moderation_terms;
CREATE TRIGGER trg_update_moderation_terms_updated_at
BEFORE UPDATE ON public.moderation_terms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.rankings
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'clean'
  CHECK (moderation_status IN ('clean', 'suggestive', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS moderation_reason TEXT NOT NULL DEFAULT 'none'
  CHECK (moderation_reason IN (
    'sexual_suggestive', 'explicit_sexual', 'minor_sexualization',
    'real_person_sexualization', 'hate', 'violence', 'privacy',
    'illegal', 'spam', 'none', 'system_error'
  )),
ADD COLUMN IF NOT EXISTS image_moderation_status TEXT NOT NULL DEFAULT 'clean'
  CHECK (image_moderation_status IN ('clean', 'suggestive', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS image_moderation_reason TEXT NOT NULL DEFAULT 'none'
  CHECK (image_moderation_reason IN (
    'sexual_suggestive', 'explicit_sexual', 'minor_sexualization',
    'real_person_sexualization', 'hate', 'violence', 'privacy',
    'illegal', 'spam', 'none', 'system_error'
  )),
ADD COLUMN IF NOT EXISTS moderation_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS moderation_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS moderation_review_note TEXT;

ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'clean'
  CHECK (moderation_status IN ('clean', 'suggestive', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS moderation_reason TEXT NOT NULL DEFAULT 'none'
  CHECK (moderation_reason IN (
    'sexual_suggestive', 'explicit_sexual', 'minor_sexualization',
    'real_person_sexualization', 'hate', 'violence', 'privacy',
    'illegal', 'spam', 'none', 'system_error'
  )),
ADD COLUMN IF NOT EXISTS image_moderation_status TEXT NOT NULL DEFAULT 'clean'
  CHECK (image_moderation_status IN ('clean', 'suggestive', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS image_moderation_reason TEXT NOT NULL DEFAULT 'none'
  CHECK (image_moderation_reason IN (
    'sexual_suggestive', 'explicit_sexual', 'minor_sexualization',
    'real_person_sexualization', 'hate', 'violence', 'privacy',
    'illegal', 'spam', 'none', 'system_error'
  )),
ADD COLUMN IF NOT EXISTS moderation_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS moderation_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS moderation_review_note TEXT;

ALTER TABLE public.ranking_entries
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'clean'
  CHECK (moderation_status IN ('clean', 'suggestive', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS moderation_reason TEXT NOT NULL DEFAULT 'none'
  CHECK (moderation_reason IN (
    'sexual_suggestive', 'explicit_sexual', 'minor_sexualization',
    'real_person_sexualization', 'hate', 'violence', 'privacy',
    'illegal', 'spam', 'none', 'system_error'
  )),
ADD COLUMN IF NOT EXISTS moderation_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS moderation_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS moderation_review_note TEXT;

ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'clean'
  CHECK (moderation_status IN ('clean', 'suggestive', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS moderation_reason TEXT NOT NULL DEFAULT 'none'
  CHECK (moderation_reason IN (
    'sexual_suggestive', 'explicit_sexual', 'minor_sexualization',
    'real_person_sexualization', 'hate', 'violence', 'privacy',
    'illegal', 'spam', 'none', 'system_error'
  )),
ADD COLUMN IF NOT EXISTS moderation_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS moderation_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS moderation_review_note TEXT;

CREATE OR REPLACE FUNCTION public.approve_ranking_moderation(
  p_ranking_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reviewed_at TIMESTAMPTZ := NOW();
  v_note TEXT := COALESCE(NULLIF(BTRIM(p_note), ''), '관리자 프리뷰 검토 완료');
BEGIN
  IF v_user_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.rankings WHERE id = p_ranking_id) THEN
    RAISE EXCEPTION '랭킹을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.rankings
  SET moderation_status = 'clean',
      moderation_reason = 'none',
      moderation_reviewed_by = v_user_id,
      moderation_reviewed_at = v_reviewed_at,
      moderation_review_note = v_note
  WHERE id = p_ranking_id;

  UPDATE public.ranking_entries
  SET moderation_status = 'clean',
      moderation_reason = 'none',
      moderation_reviewed_by = v_user_id,
      moderation_reviewed_at = v_reviewed_at,
      moderation_review_note = v_note
  WHERE ranking_id = p_ranking_id;

  UPDATE public.items
  SET moderation_status = 'clean',
      moderation_reason = 'none',
      moderation_reviewed_by = v_user_id,
      moderation_reviewed_at = v_reviewed_at,
      moderation_review_note = v_note
  WHERE id IN (
    SELECT item_id
    FROM public.ranking_entries
    WHERE ranking_id = p_ranking_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_ranking_moderation(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_ranking_moderation(UUID, TEXT) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_moderation_terms_enabled_severity
  ON public.moderation_terms (enabled, severity);
CREATE INDEX IF NOT EXISTS idx_rankings_public_moderation
  ON public.rankings (status, moderation_status, image_moderation_status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_public_moderation
  ON public.items (status, moderation_status, image_moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_entries_moderation
  ON public.ranking_entries (ranking_id, moderation_status);
CREATE INDEX IF NOT EXISTS idx_comments_moderation
  ON public.comments (status, moderation_status, created_at DESC);

INSERT INTO public.moderation_terms (term, severity, category, match_mode, note) VALUES
('아동청소년성착취물', 'block', 'minor_sexualization', 'compact_substring', '아동·청소년 성착취물 차단'),
('아청물', 'block', 'minor_sexualization', 'compact_substring', '미성년 성착취물 차단'),
('딥페이크 성착취물', 'block', 'illegal', 'compact_substring', '딥페이크 성착취물 차단'),
('불법촬영물 공유', 'block', 'privacy', 'compact_substring', '불법촬영물 유포·공유 차단'),
('불법촬영물 다운로드', 'block', 'privacy', 'compact_substring', '불법촬영물 취득 차단'),
('섹스동영상', 'block', 'explicit_sexual', 'compact_substring', '노골적 성행위 영상 차단'),
('마약구매', 'block', 'illegal', 'compact_substring', '마약 구매·유통 조장 차단'),
('자살방법', 'block', 'violence', 'compact_substring', '자해 방법 제공 차단'),
('porno', 'block', 'explicit_sexual', 'substring', '노골적 음란물 표현 차단'),
('딥페이크', 'review', 'illegal', 'compact_substring', '정보성·비판성 맥락 포함 관리자 검토'),
('불법촬영', 'review', 'privacy', 'compact_substring', '정보성·비판성 맥락 포함 관리자 검토'),
('아청', 'review', 'minor_sexualization', 'compact_substring', '미성년 성적 대상화 가능성 검토'),
('섹시', 'review', 'sexual_suggestive', 'compact_substring', '선정적 표현 표시'),
('성인물', 'review', 'sexual_suggestive', 'compact_substring', '성인 콘텐츠 맥락 검토'),
('로리', 'review', 'minor_sexualization', 'compact_substring', '미성년 성적 대상화 가능성 검토'),
('자살', 'review', 'violence', 'compact_substring', '자해·극단 선택 맥락 검토'),
('칼침', 'review', 'violence', 'compact_substring', '강한 폭력 표현 검토'),
('살해', 'review', 'violence', 'compact_substring', '강한 폭력 표현 검토')
ON CONFLICT (term) DO UPDATE SET
  severity = EXCLUDED.severity,
  category = EXCLUDED.category,
  match_mode = EXCLUDED.match_mode,
  note = EXCLUDED.note,
  enabled = TRUE,
  updated_at = NOW();

DROP POLICY IF EXISTS "Items viewable by everyone if active" ON public.items;
CREATE POLICY "Items viewable by everyone if active"
ON public.items
FOR SELECT
USING (
  public.is_admin()
  OR (
    status = 'active'
    AND moderation_status IN ('clean', 'suggestive')
    AND image_moderation_status IN ('clean', 'suggestive')
  )
);

DROP POLICY IF EXISTS "Item facets viewable by everyone" ON public.item_facets;
CREATE POLICY "Item facets viewable by everyone"
ON public.item_facets
FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.items i
    WHERE i.id = item_id
      AND i.status = 'active'
      AND i.moderation_status IN ('clean', 'suggestive')
      AND i.image_moderation_status IN ('clean', 'suggestive')
  )
);

DROP POLICY IF EXISTS "Rankings select policy" ON public.rankings;
CREATE POLICY "Rankings select policy"
ON public.rankings
FOR SELECT
USING (
  public.is_admin()
  OR (
    status = 'published'
    AND moderation_status IN ('clean', 'suggestive')
    AND image_moderation_status IN ('clean', 'suggestive')
  )
);

DROP POLICY IF EXISTS "Ranking entries select policy" ON public.ranking_entries;
CREATE POLICY "Ranking entries select policy"
ON public.ranking_entries
FOR SELECT
USING (
  public.is_admin()
  OR (
    moderation_status IN ('clean', 'suggestive')
    AND EXISTS (
      SELECT 1
      FROM public.rankings r
      WHERE r.id = ranking_id
        AND r.status = 'published'
        AND r.moderation_status IN ('clean', 'suggestive')
        AND r.image_moderation_status IN ('clean', 'suggestive')
    )
  )
);

DROP POLICY IF EXISTS "Ranking facets select policy" ON public.ranking_facets;
CREATE POLICY "Ranking facets select policy"
ON public.ranking_facets
FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.rankings r
    WHERE r.id = ranking_id
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
  )
);

DROP POLICY IF EXISTS "Ranking criteria select policy" ON public.ranking_criteria;
CREATE POLICY "Ranking criteria select policy"
ON public.ranking_criteria
FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.rankings r
    WHERE r.id = ranking_id
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
  )
);

DROP POLICY IF EXISTS "Ranking sources select policy" ON public.ranking_sources;
CREATE POLICY "Ranking sources select policy"
ON public.ranking_sources
FOR SELECT
USING (
  public.is_admin()
  OR (
    is_public = TRUE
    AND EXISTS (
      SELECT 1
      FROM public.rankings r
      WHERE r.id = ranking_id
        AND r.status = 'published'
        AND r.moderation_status IN ('clean', 'suggestive')
        AND r.image_moderation_status IN ('clean', 'suggestive')
    )
  )
);

DROP POLICY IF EXISTS "Comments viewable if visible" ON public.comments;
CREATE POLICY "Comments viewable if visible"
ON public.comments
FOR SELECT
USING (
  public.is_admin()
  OR (
    status = 'visible'
    AND moderation_status IN ('clean', 'suggestive')
  )
);

COMMIT;
