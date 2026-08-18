import Link from 'next/link'
import { AlertTriangle, Building2, ClipboardList, Database, FileSpreadsheet, Flag, FolderKanban, Megaphone, MessageSquare, Package, ShieldAlert, Tag, UserCog } from 'lucide-react'
import { getMyAdminAccess } from '@/lib/actions/admin-access'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const access = await getMyAdminAccess()
  const capabilities = new Set(access.capabilities)

  const menuItems = [
    { title: '댓글 Moderation', description: '보류·차단 댓글을 검토하고 공개 상태를 결정합니다.', href: '/admin/comments', icon: MessageSquare, capability: 'moderation_review' },
    { title: '댓글 신고 운영', description: '신고 사건을 검토하고 댓글·작성자 조치를 결정합니다.', href: '/admin/comment-reports', icon: Flag, capability: 'report_review' },
    { title: '사용자 제재·이의제기', description: '계정 제재와 이의제기 결정을 감사 원장으로 관리합니다.', href: '/admin/user-sanctions', icon: ShieldAlert, capability: 'sanction_view' },
    { title: '운영 감사 기록', description: '역할, Moderation, 신고, 제재, 협찬 및 유지보수 결정을 통합 조회합니다.', href: '/admin/audit', icon: ClipboardList, capability: 'audit_view' },
    { title: '운영 보안 이벤트', description: '권한 거부, 검증 실패, 충돌 및 비정상 조회의 반복 패턴을 확인합니다.', href: '/admin/security-events', icon: AlertTriangle, capability: 'security_event_view' },
    { title: '유지보수 자동화', description: 'Cron 등록과 보존정책 작업의 최근 실행 상태를 조회합니다.', href: '/admin/maintenance', icon: Database, capability: 'audit_view' },
    { title: '운영 역할 관리', description: '모더레이터·관리자·최고 관리자 역할을 관리합니다.', href: '/admin/access-control', icon: UserCog, capability: 'role_manage' },
    { title: '협찬 주체 관리', description: '브랜드·기관 등 상업 관계의 주체와 상태를 관리합니다.', href: '/admin/sponsors', icon: Building2, capability: 'sponsorship_manage' },
    { title: '협찬 관계 관리', description: '랭킹·아이템·배치 협찬 관계를 초안, 공개, 보관 상태로 관리합니다.', href: '/admin/sponsorships', icon: Megaphone, capability: 'sponsorship_manage' },
    { title: '카테고리 관리', description: '대분류 카테고리와 노출 순서를 관리합니다.', href: '/admin/categories', icon: FolderKanban, capability: 'content_manage' },
    { title: '서브카테고리 관리', description: '카테고리 종속 분류를 관리합니다.', href: '/admin/subcategories', icon: FolderKanban, capability: 'content_manage' },
    { title: '페이셋 관리', description: '검색·필터용 페이셋과 태그를 관리합니다.', href: '/admin/facets', icon: Tag, capability: 'content_manage' },
    { title: '아이템 관리', description: '랭킹에 연결할 아이템과 메타데이터를 관리합니다.', href: '/admin/items', icon: Package, capability: 'content_manage' },
    { title: '랭킹 문서 관리', description: '랭킹 작성, 검토, 발행 루프를 수행합니다.', href: '/admin/rankings', icon: FileSpreadsheet, capability: 'content_manage' },
  ].filter((item) => capabilities.has(item.capability))

  const roleLabel = access.roleLevel === 'super_admin'
    ? '최고 관리자'
    : access.roleLevel === 'admin'
      ? '관리자'
      : access.roleLevel === 'moderator'
        ? '모더레이터'
        : '권한 없음'

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="border-b border-white/[0.06] pb-6">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-300">Operator Console</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black text-white">운영 통제 본부</h1>
            <span className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-xs font-bold text-indigo-200">{roleLabel}</span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">현재 역할에 부여된 capability만 표시됩니다. 화면 접근과 실제 변경 권한은 데이터베이스 RPC에서도 다시 검증됩니다.</p>
        </header>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition hover:border-indigo-500/25 hover:bg-indigo-500/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-indigo-300"><Icon className="h-5 w-5" /></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{item.capability}</span>
                </div>
                <h2 className="mt-5 font-black text-white transition group-hover:text-indigo-200">{item.title}</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.description}</p>
              </Link>
            )
          })}
        </section>

        {menuItems.length === 0 && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-200">사용 가능한 운영 capability가 없습니다.</div>
        )}
      </div>
    </div>
  )
}
