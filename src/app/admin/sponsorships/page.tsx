import Link from 'next/link'
import { Archive, ArrowLeft, CheckCircle2, ClipboardList, Megaphone, Send, Save, ShieldAlert } from 'lucide-react'
import SponsorshipDisclosure from '@/components/sponsorship/SponsorshipDisclosure'
import type { SponsorshipDisclosure as PublicSponsorshipDisclosure } from '@/lib/queries/sponsorships'
import {
  archiveSponsorshipAction,
  createSponsorshipAction,
  getSponsorshipOptions,
  getSponsorshipReadiness,
  listSponsors,
  listSponsorshipEvents,
  listSponsorships,
  publishSponsorshipAction,
  updateSponsorshipAction,
  type SponsorshipRow,
} from '@/lib/actions/sponsorship-admin'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ ok?: string; error?: string }> }

const relationshipLabels: Record<string, string> = {
  financial_support: '금전 지원',
  product_provided: '제품 제공',
  paid_placement: '유료 배치',
  affiliate: '제휴/어필리에이트',
  other: '기타',
}

const influenceLabels: Record<string, string> = {
  none: '편집 영향 없음',
  candidate_inclusion: '후보 포함에 영향',
  ranking_order: '순위 결정에 영향',
  methodology: '평가 방법에 영향',
  other: '기타 영향',
}

function datetime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

function previewDisclosure(row: SponsorshipRow): PublicSponsorshipDisclosure {
  return {
    id: row.id,
    sponsor_name: row.sponsor_name,
    sponsor_website_url: null,
    target_type: row.target_type,
    ranking_id: row.ranking_id,
    item_id: row.item_id,
    relationship_type: row.relationship_type,
    disclosure_text: row.disclosure_text,
    influence_scope: row.influence_scope,
    influence_note: row.influence_note,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    published_at: row.published_at || row.updated_at,
    period_state: row.period_state,
  }
}

export default async function SponsorshipsAdminPage({ searchParams }: Props) {
  const [sponsors, sponsorships, events, options, readiness, params] = await Promise.all([
    listSponsors(),
    listSponsorships(),
    listSponsorshipEvents(30),
    getSponsorshipOptions(),
    getSponsorshipReadiness(),
    searchParams,
  ])
  const activeSponsors = sponsors.filter((sponsor) => sponsor.status === 'active')

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="border-b border-white/[0.06] pb-6">
          <Link href="/admin" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-300"><ArrowLeft className="h-3.5 w-3.5" />운영 통제 본부</Link>
          <p className="mt-5 text-xs font-black uppercase tracking-widest text-indigo-300">P2-3 Sponsor Transparency</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-white">협찬 관계 관리</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">협찬 관계를 초안으로 기록하고 검토 후 공개합니다. 공개된 관계는 일반 랭킹 편집에서 제거할 수 없으며 먼저 이 화면에서 보관 처리해야 합니다.</p></div><Link href="/admin/sponsors" className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-2.5 text-xs font-black text-indigo-200">협찬 주체 관리</Link></div>
        </header>

        {params.ok && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">{params.ok}</div>}
        {params.error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">{params.error}</div>}

        <section className={`rounded-2xl border p-5 ${readiness.normalizedAuthorityReady ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : 'border-rose-500/20 bg-rose-500/[0.06]'}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className={`flex items-center gap-2 text-sm font-black ${readiness.normalizedAuthorityReady ? 'text-emerald-200' : 'text-rose-200'}`}>
                {readiness.normalizedAuthorityReady ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                Normalized sponsorship authority
              </div>
              <p className="mt-2 text-xs leading-6 text-slate-400">Legacy `sponsor_flag`는 더 이상 협찬 truth가 아닙니다. 미해결 플래그가 0일 때만 정규화된 협찬 권위를 정상 상태로 봅니다.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-black">
              <span className={`rounded-lg px-2.5 py-1.5 ${readiness.unresolvedLegacyFlags === 0 ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200'}`}>미해결 legacy {readiness.unresolvedLegacyFlags}</span>
              <span className="rounded-lg bg-indigo-500/10 px-2.5 py-1.5 text-indigo-200">reconcile 이력 {readiness.legacyReconcileEvents}</span>
              <span className="rounded-lg bg-cyan-500/10 px-2.5 py-1.5 text-cyan-200">공개 관계 {readiness.publishedSponsorships}</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
          <h2 className="flex items-center gap-2 font-black text-white"><Megaphone className="h-5 w-5 text-indigo-300" />새 협찬 관계 초안</h2>
          {activeSponsors.length === 0 ? (
            <p className="mt-4 text-sm text-amber-300">활성 협찬 주체가 없습니다. 먼저 협찬 주체를 등록해 주세요.</p>
          ) : (
            <form action={createSponsorshipAction} className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-bold text-slate-400">협찬 주체 *<select name="sponsor_id" required className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white">{activeSponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-400">대상 종류 *<select name="target_type" required defaultValue="ranking" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="ranking">랭킹 전체</option><option value="item">아이템 전체</option><option value="placement">특정 랭킹의 아이템 배치</option></select></label>
              <label className="text-xs font-bold text-slate-400">관계 유형 *<select name="relationship_type" required defaultValue="financial_support" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white">{Object.entries(relationshipLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-400">랭킹 대상<select name="ranking_id" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="">선택 안 함</option>{options.rankings.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-400">아이템 대상<select name="item_id" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="">선택 안 함</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-400">편집 영향 *<select name="influence_scope" required defaultValue="none" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white">{Object.entries(influenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-400 lg:col-span-3">공개 문구 *<textarea name="disclosure_text" required minLength={3} maxLength={2000} rows={3} placeholder="예: 이 랭킹은 브랜드의 금전 지원을 받았으나 순위 선정에는 관여하지 않았습니다." className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" /></label>
              <label className="text-xs font-bold text-slate-400 lg:col-span-3">영향 상세<textarea name="influence_note" rows={2} placeholder="영향이 none이 아니거나 other인 경우 구체적으로 기록" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" /></label>
              <label className="text-xs font-bold text-slate-400">시작 시각 *<input name="starts_at" required placeholder="2026-08-18T15:00:00+09:00" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" /></label>
              <label className="text-xs font-bold text-slate-400">종료 시각<input name="ends_at" placeholder="2026-09-18T15:00:00+09:00" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" /></label>
              <label className="text-xs font-bold text-slate-400">내부 메모<input name="internal_note" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" /></label>
              <label className="text-xs font-bold text-slate-400 lg:col-span-3">생성 사유 *<textarea name="reason" required minLength={10} rows={2} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" /></label>
              <button className="inline-flex w-fit items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-500"><Save className="h-4 w-4" />초안 생성</button>
            </form>
          )}
          <p className="mt-4 text-[11px] leading-5 text-slate-600">대상 규칙: 랭킹 전체는 랭킹만, 아이템 전체는 아이템만, 배치는 랭킹과 아이템을 모두 선택해야 합니다. 배치는 실제 해당 랭킹에 존재하는 아이템만 공개할 수 있습니다.</p>
        </section>

        <section className="space-y-4">
          <h2 className="font-black text-white">협찬 관계</h2>
          {sponsorships.length === 0 && <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-8 text-center text-sm text-slate-500">등록된 협찬 관계가 없습니다.</div>}
          {sponsorships.map((row) => (
            <article key={row.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-white">{row.sponsor_name}</h3><span className="rounded-md bg-indigo-500/10 px-2 py-1 text-[10px] font-black text-indigo-200">{row.target_type}</span><span className={`rounded-md px-2 py-1 text-[10px] font-black ${row.status === 'published' ? 'bg-emerald-500/10 text-emerald-300' : row.status === 'draft' ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-500/10 text-slate-400'}`}>{row.status}</span></div><p className="mt-2 text-xs text-slate-500">{row.ranking_title || ''}{row.ranking_title && row.item_title ? ' · ' : ''}{row.item_title || ''}</p></div>
                <div className="text-right text-[11px] text-slate-600"><p>{relationshipLabels[row.relationship_type] || row.relationship_type}</p><p>{datetime(row.starts_at)} → {datetime(row.ends_at)}</p></div>
              </div>
              <div className="mt-4 rounded-xl border border-white/[0.05] bg-black/20 p-4"><p className="text-xs font-bold text-slate-300">공개 문구</p><p className="mt-1 text-sm leading-6 text-slate-400">{row.disclosure_text}</p><p className="mt-2 text-[11px] text-slate-600">편집 영향: {influenceLabels[row.influence_scope] || row.influence_scope}{row.influence_note ? ` · ${row.influence_note}` : ''}</p></div>
              <div className="mt-4 rounded-xl border border-indigo-500/10 bg-indigo-500/[0.03] p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-indigo-300">공개 미리보기</p><SponsorshipDisclosure disclosures={[previewDisclosure(row)]} compact /></div>

              {row.status === 'draft' && (
                <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_260px]">
                  <form action={updateSponsorshipAction} className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <input type="hidden" name="id" value={row.id} />
                    <label className="text-[11px] font-bold text-slate-500">협찬 주체<select name="sponsor_id" defaultValue={row.sponsor_id} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white">{activeSponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                    <label className="text-[11px] font-bold text-slate-500">대상 종류<select name="target_type" defaultValue={row.target_type} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white"><option value="ranking">ranking</option><option value="item">item</option><option value="placement">placement</option></select></label>
                    <label className="text-[11px] font-bold text-slate-500">관계 유형<select name="relationship_type" defaultValue={row.relationship_type} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white">{Object.entries(relationshipLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                    <label className="text-[11px] font-bold text-slate-500">랭킹<select name="ranking_id" defaultValue={row.ranking_id || ''} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white"><option value="">없음</option>{options.rankings.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
                    <label className="text-[11px] font-bold text-slate-500">아이템<select name="item_id" defaultValue={row.item_id || ''} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white"><option value="">없음</option>{options.items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select></label>
                    <label className="text-[11px] font-bold text-slate-500">편집 영향<select name="influence_scope" defaultValue={row.influence_scope} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white">{Object.entries(influenceLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                    <textarea name="disclosure_text" required defaultValue={row.disclosure_text} rows={2} className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white md:col-span-2 lg:col-span-3" />
                    <input name="influence_note" defaultValue={row.influence_note || ''} placeholder="영향 상세" className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white" />
                    <input name="starts_at" required defaultValue={row.starts_at} className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white" />
                    <input name="ends_at" defaultValue={row.ends_at || ''} placeholder="종료 시각" className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white" />
                    <input name="internal_note" defaultValue={row.internal_note || ''} placeholder="내부 메모" className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white lg:col-span-3" />
                    <textarea name="reason" required minLength={10} rows={2} placeholder="수정 사유 (10자 이상)" className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white md:col-span-2 lg:col-span-3" />
                    <button className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs font-black text-indigo-200"><Save className="h-3.5 w-3.5" />초안 수정</button>
                  </form>
                  <form action={publishSponsorshipAction} className="flex flex-col gap-2 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-3">
                    <input type="hidden" name="id" value={row.id} />
                    <textarea name="reason" required minLength={10} rows={3} placeholder="공개 사유 (10자 이상)" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" />
                    <button className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200"><Send className="h-3.5 w-3.5" />공개</button>
                  </form>
                </div>
              )}

              {row.status !== 'archived' && (
                <form action={archiveSponsorshipAction} className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-4">
                  <input type="hidden" name="id" value={row.id} />
                  <input name="reason" required minLength={10} placeholder="보관 사유 (10자 이상)" className="min-w-64 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" />
                  <button className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-200"><Archive className="h-3.5 w-3.5" />보관</button>
                </form>
              )}
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
          <h2 className="flex items-center gap-2 font-black text-white"><ClipboardList className="h-5 w-5 text-indigo-300" />최근 협찬 감사 기록</h2>
          <div className="mt-4 divide-y divide-white/[0.05]">
            {events.map((event) => <div key={event.id} className="grid gap-1 py-3 text-xs sm:grid-cols-[150px_120px_1fr_auto]"><span className="font-bold text-indigo-200">{event.action}</span><span className="text-slate-500">{event.actor_label}</span><span className="text-slate-400">{event.reason}</span><span className="text-slate-600">{datetime(event.created_at)}</span></div>)}
            {events.length === 0 && <p className="py-6 text-center text-sm text-slate-600">감사 기록이 없습니다.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
