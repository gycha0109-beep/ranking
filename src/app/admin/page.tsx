import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  FolderKanban,
  Layers,
  Tag,
  Package,
  FileSpreadsheet,
  ChevronRight,
  PlusCircle,
  Eye,
  FileEdit,
  MessageSquare,
  Flag,
} from 'lucide-react'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const [
    { count: categoryCount },
    { count: subcategoryCount },
    { count: itemCount },
    { count: facetCount },
    { count: pendingCommentCount },
    { data: pendingReportCaseCountData },
    { data: rankingsData },
  ] = await Promise.all([
    supabase.from('categories').select('*', { count: 'exact', head: true }),
    supabase.from('subcategories').select('*', { count: 'exact', head: true }),
    supabase.from('items').select('*', { count: 'exact', head: true }),
    supabase.from('facets').select('*', { count: 'exact', head: true }),
    supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .in('moderation_status', ['needs_review', 'blocked'])
      .neq('status', 'deleted'),
    supabase.rpc('get_pending_comment_report_case_count'),
    supabase.from('rankings').select('status'),
  ])

  const rankings = rankingsData || []
  const totalRankings = rankings.length
  const draftRankings = rankings.filter((ranking) => ranking.status === 'draft').length
  const publishedRankings = rankings.filter((ranking) => ranking.status === 'published').length
  const parsedReportCaseCount = Number(pendingReportCaseCountData)
  const pendingReportCaseCount = Number.isFinite(parsedReportCaseCount) && parsedReportCaseCount >= 0
    ? parsedReportCaseCount
    : 0

  const stats = [
    { name: '카테고리', count: categoryCount || 0, icon: FolderKanban, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
    { name: '서브카테고리', count: subcategoryCount || 0, icon: Layers, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
    { name: '페이셋 태그', count: facetCount || 0, icon: Tag, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { name: '등록 아이템', count: itemCount || 0, icon: Package, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  ]

  const menuItems = [
    {
      title: '카테고리 관리',
      description: '대분류 카테고리를 추가하고 노출 순서 및 활성화 여부를 관리합니다.',
      href: '/admin/categories',
      icon: FolderKanban,
      count: categoryCount || 0,
      color: 'from-indigo-600 to-indigo-500',
    },
    {
      title: '서브카테고리 관리',
      description: '카테고리에 종속된 서브카테고리를 생성하고 매핑을 관리합니다.',
      href: '/admin/subcategories',
      icon: Layers,
      count: subcategoryCount || 0,
      color: 'from-sky-600 to-sky-500',
    },
    {
      title: '페이셋 관리',
      description: '필터 및 검색 정밀도 향상을 위한 페이셋 그룹 및 하위 태그들을 관리합니다.',
      href: '/admin/facets',
      icon: Tag,
      count: facetCount || 0,
      color: 'from-emerald-600 to-emerald-500',
    },
    {
      title: '아이템(상품) 관리',
      description: '순위표에 연동할 상품/아이템을 등록하고, 다중 페이셋 태그를 매핑합니다.',
      href: '/admin/items',
      icon: Package,
      count: itemCount || 0,
      color: 'from-amber-600 to-amber-500',
    },
    {
      title: '랭킹 문서 관리 (E2E)',
      description: '드래프트 생성, 순위 및 기준 매핑, 프리뷰 검증, 최종 발행 및 관리 루프를 수행합니다.',
      href: '/admin/rankings',
      icon: FileSpreadsheet,
      count: totalRankings || 0,
      color: 'from-purple-600 to-purple-500',
      badge: `${publishedRankings}개 발행 / ${draftRankings}개 대기`,
    },
    {
      title: '댓글 Moderation',
      description: '자동 판정으로 보류 또는 차단된 댓글 원문과 감사 이력을 검토하고 공개 상태를 결정합니다.',
      href: '/admin/comments',
      icon: MessageSquare,
      count: pendingCommentCount || 0,
      color: 'from-rose-600 to-orange-500',
      badge: `${pendingCommentCount || 0}개 검토 대기`,
    },
    {
      title: '댓글 신고·운영 제재',
      description: '사용자 신고를 댓글 단위 사건으로 검토하고 유지, 기각, 숨김, 차단 및 작성자 경고 기록을 결정합니다.',
      href: '/admin/comment-reports',
      icon: Flag,
      count: pendingReportCaseCount,
      color: 'from-fuchsia-600 to-rose-500',
      badge: `${pendingReportCaseCount}개 신고 사건`,
    },
  ]

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a0a0f] to-[#07070a] text-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-6 border-b border-white/[0.06]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">어드민 통제 본부</span>
              <span className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-md">P0-Core</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              랭킹위키 MVP 랭킹 문서 발행 루프 및 메타 데이터 CMS 시스템
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/rankings/new"
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 border border-indigo-500/30 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/15"
            >
              <PlusCircle className="w-4 h-4" />
              새 랭킹 생성
            </Link>
            <Link
              href="/"
              target="_blank"
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-slate-300 transition-all flex items-center gap-1.5"
            >
              <Eye className="w-4 h-4" />
              공개 화면 보기
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 tracking-wider">전체 랭킹 문서</span>
              <FileSpreadsheet className="w-5 h-5 text-purple-400" />
            </div>
            <div className="mt-4">
              <span className="text-3xl sm:text-4xl font-black text-white">{totalRankings}</span>
              <span className="text-xs text-slate-500 ml-1.5">개 아카이브</span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 tracking-wider">발행된 랭킹 (Published)</span>
              <Eye className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="mt-4">
              <span className="text-3xl sm:text-4xl font-black text-emerald-400">{publishedRankings}</span>
              <span className="text-xs text-slate-500 ml-1.5">개 서비스 중</span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 tracking-wider">작성 중 드래프트 (Draft)</span>
              <FileEdit className="w-5 h-5 text-amber-400" />
            </div>
            <div className="mt-4">
              <span className="text-3xl sm:text-4xl font-black text-amber-400">{draftRankings}</span>
              <span className="text-xs text-slate-500 ml-1.5">개 검토 대기</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.name}
                className={`p-4 rounded-xl border ${stat.border} ${stat.bg} flex items-center gap-4`}
              >
                <div className={`p-2.5 rounded-lg bg-black/20 ${stat.color} shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-400">{stat.name}</p>
                  <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5">{stat.count}</p>
                </div>
              </div>
            )
          })}
        </div>

        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">CMS 관리 항목</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((menu) => {
            const Icon = menu.icon
            return (
              <Link
                key={menu.href}
                href={menu.href}
                className="group relative overflow-hidden flex flex-col justify-between p-6 rounded-2xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] hover:border-indigo-500/25 transition-all shadow-lg"
              >
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all pointer-events-none" />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${menu.color} text-white shadow-md`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {menu.badge ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300">
                        {menu.badge}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-500 bg-white/[0.02] border border-white/5 px-2.5 py-0.5 rounded-md">
                        {menu.count}개
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-slate-100 group-hover:text-indigo-300 transition-colors">
                    {menu.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {menu.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-end text-xs font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors gap-0.5">
                  들어가기
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
