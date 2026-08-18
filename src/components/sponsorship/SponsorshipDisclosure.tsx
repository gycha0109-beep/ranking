import { ExternalLink, ShieldCheck } from 'lucide-react'
import type { SponsorshipDisclosure as Disclosure, SponsorshipPeriodState } from '@/lib/queries/sponsorships'

const relationshipLabels: Record<string, string> = {
  financial_support: '금전 지원',
  product_provided: '제품 제공',
  paid_placement: '유료 배치',
  affiliate: '제휴 관계',
  other: '기타 상업 관계',
}

const influenceLabels: Record<string, string> = {
  none: '선정·순위에 영향 없음',
  candidate_inclusion: '후보 포함에 영향',
  ranking_order: '순위 결정에 영향',
  methodology: '평가 방법에 영향',
  other: '기타 편집 영향',
}

const periodLabels: Record<SponsorshipPeriodState, string> = {
  upcoming: '공개 예정 관계',
  current: '현재 관계',
  historical: '과거 공개 이력',
}

const periodClasses: Record<SponsorshipPeriodState, string> = {
  upcoming: 'border-[#cbd5f5] bg-[#f5f7ff] text-[#3457c8]',
  current: 'border-[#ead8a8] bg-[#fffaf0] text-[#8f650f]',
  historical: 'border-[#dfe4ea] bg-[#f7f8fa] text-[#667085]',
}

function dateLabel(value: string | null) {
  if (!value) return '종료일 없음'
  return new Date(value).toLocaleDateString('ko-KR')
}

export default function SponsorshipDisclosure({
  disclosures,
  compact = false,
}: {
  disclosures: Disclosure[]
  compact?: boolean
}) {
  if (disclosures.length === 0) return null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'} aria-label="협찬 및 상업 관계 공개">
      {disclosures.map((disclosure) => {
        const stateClass = periodClasses[disclosure.period_state]
        return (
          <aside key={disclosure.id} className={`rounded-xl border ${stateClass} ${compact ? 'px-3 py-2.5' : 'p-4 sm:p-5'}`}>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />협찬·상업 관계 공개</span>
              <span className="rounded-full border border-current/20 px-2 py-0.5">{periodLabels[disclosure.period_state]}</span>
              <span>·</span>
              <span>{relationshipLabels[disclosure.relationship_type] || disclosure.relationship_type}</span>
              <span>·</span>
              <span>{influenceLabels[disclosure.influence_scope] || disclosure.influence_scope}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <strong className="text-xs">{disclosure.sponsor_name}</strong>
              {disclosure.sponsor_website_url && (
                <a href={disclosure.sponsor_website_url} target="_blank" rel="noopener noreferrer" aria-label={`${disclosure.sponsor_name} 웹사이트 열기`} className="inline-flex items-center gap-1 text-[10px] font-bold hover:underline">웹사이트 <ExternalLink className="h-3 w-3" /></a>
              )}
            </div>
            <p className={`${compact ? 'mt-1.5 text-[11px] leading-5' : 'mt-2 text-xs leading-6'} opacity-85`}>{disclosure.disclosure_text}</p>
            {disclosure.influence_note && <p className="mt-1 text-[10px] leading-5 opacity-75">편집 영향 상세: {disclosure.influence_note}</p>}
            {!compact && <p className="mt-2 text-[10px] opacity-70">관계 기간: {dateLabel(disclosure.starts_at)} ~ {dateLabel(disclosure.ends_at)}</p>}
          </aside>
        )
      })}
    </div>
  )
}
