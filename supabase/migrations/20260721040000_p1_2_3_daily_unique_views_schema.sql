BEGIN;

CREATE TABLE public.content_daily_views (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  viewer_key_hash TEXT NOT NULL,
  viewed_on DATE NOT NULL,
  key_version SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_daily_views_exactly_one_target
    CHECK (num_nonnulls(ranking_id, item_id) = 1),
  CONSTRAINT content_daily_views_hash_format
    CHECK (viewer_key_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT content_daily_views_key_version
    CHECK (key_version = 1)
);

CREATE UNIQUE INDEX uq_content_daily_views_ranking
  ON public.content_daily_views(ranking_id, viewer_key_hash, viewed_on)
  WHERE ranking_id IS NOT NULL;

CREATE UNIQUE INDEX uq_content_daily_views_item
  ON public.content_daily_views(item_id, viewer_key_hash, viewed_on)
  WHERE item_id IS NOT NULL;

CREATE INDEX idx_content_daily_views_ranking_date
  ON public.content_daily_views(ranking_id, viewed_on)
  WHERE ranking_id IS NOT NULL;

CREATE INDEX idx_content_daily_views_item_date
  ON public.content_daily_views(item_id, viewed_on)
  WHERE item_id IS NOT NULL;

CREATE INDEX idx_content_daily_views_retention
  ON public.content_daily_views(viewed_on, id);

CREATE TABLE public.content_view_totals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  unique_view_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_view_totals_exactly_one_target
    CHECK (num_nonnulls(ranking_id, item_id) = 1),
  CONSTRAINT content_view_totals_non_negative
    CHECK (unique_view_count >= 0)
);

CREATE UNIQUE INDEX uq_content_view_totals_ranking
  ON public.content_view_totals(ranking_id)
  WHERE ranking_id IS NOT NULL;

CREATE UNIQUE INDEX uq_content_view_totals_item
  ON public.content_view_totals(item_id)
  WHERE item_id IS NOT NULL;

ALTER TABLE public.content_daily_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_view_totals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.content_daily_views FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.content_view_totals FROM PUBLIC, anon, authenticated;

COMMIT;
