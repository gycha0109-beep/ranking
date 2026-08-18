import Link from 'next/link'
import { Archive, ArrowLeft, Building2, ExternalLink, Save } from 'lucide-react'
import {
  archiveSponsorAction,
  createSponsorAction,
  listSponsors,
  updateSponsorAction,
} from '@/lib/actions/sponsorship-admin'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ ok?: string; error?: string }> }

export default async function SponsorsAdminPage({ searchParams }: Props) {
  const [sponsors, params] = await Promise.all([listSponsors(), searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-white/[0.06] pb-6">
          <Link href="/admin" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-300"><ArrowLeft className="h-3.5 w-3.5" />운영 통제 본부</Link>
          <p className="mt-5 text-xs font-black uppercase tracking-widest text-indigo-300">P2-3 Sponsor Transparency</p>
          <h1 className="mt-2 text-3xl font-black text-white">협찬 주체 관리</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">브랜드·기관 등 상업 관계의 주체를 관리합니다. 실제 공개 관계는 협찬 관계 화면에서 별도로 초안 작성 후 공개해야 합니다.</p>
        </header>

        {params.ok && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">{params.ok}</div>}
        {params.error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">{params.error}</div>}

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
          <h2 className="flex items-center gap-2 font-black text-white"><Building2 className="h-5 w-5 text-indigo-300" />새 협찬 주체</h2>
          <form action={createSponsorAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-bold text-slate-400">이름 *<input name="name" required maxLength={200} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" /></label>
            <label className="text-xs font-bold text-slate-400">슬러그 *<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="brand-name" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" /></label>
            <label className="text-xs font-bold text-slate-400 md:col-span-2">웹사이트 URL<input name="website_url" type="url" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" /></label>
            <label className="text-xs font-bold text-slate-400 md:col-span-2">생성 사유 *<textarea name="reason" required minLength={10} rows={2} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" /></label>
            <button className="inline-flex w-fit items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-500"><Save className="h-4 w-4" />협찬 주체 생성</button>
          </form>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4"><h2 className="font-black text-white">등록된 협찬 주체</h2><Link href="/admin/sponsorships" className="text-xs font-bold text-indigo-300 hover:text-indigo-200">협찬 관계 관리 →</Link></div>
          {sponsors.length === 0 && <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-8 text-center text-sm text-slate-500">등록된 협찬 주체가 없습니다.</div>}
          {sponsors.map((sponsor) => (
            <article key={sponsor.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><h3 className="font-black text-white">{sponsor.name}</h3><span className={`rounded-md px-2 py-1 text-[10px] font-black ${sponsor.status === 'active' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-500/10 text-slate-400'}`}>{sponsor.status}</span></div><p className="mt-1 text-xs text-slate-600">{sponsor.slug}</p></div>
                {sponsor.website_url && <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-300"><ExternalLink className="h-3.5 w-3.5" />사이트</a>}
              </div>

              {sponsor.status === 'active' && (
                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
                  <form action={updateSponsorAction} className="grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="id" value={sponsor.id} />
                    <input name="name" required defaultValue={sponsor.name} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" />
                    <input name="slug" required defaultValue={sponsor.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" />
                    <input name="website_url" type="url" defaultValue={sponsor.website_url || ''} placeholder="웹사이트 URL" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white md:col-span-2" />
                    <textarea name="reason" required minLength={10} rows={2} placeholder="수정 사유 (10자 이상)" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white md:col-span-2" />
                    <button className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs font-black text-indigo-200"><Save className="h-3.5 w-3.5" />수정 저장</button>
                  </form>
                  <form action={archiveSponsorAction} className="flex min-w-56 flex-col gap-2 rounded-xl border border-amber-500/10 bg-amber-500/[0.04] p-3">
                    <input type="hidden" name="id" value={sponsor.id} />
                    <textarea name="reason" required minLength={10} rows={2} placeholder="보관 사유 (10자 이상)" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" />
                    <button className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-200"><Archive className="h-3.5 w-3.5" />보관 처리</button>
                  </form>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
