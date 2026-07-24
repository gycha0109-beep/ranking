'use server'

import { requireAdminCapability } from '@/lib/actions/admin-access'

export async function loadMaintenanceAdminData() {
  try {
    const supabase = await requireAdminCapability('audit_view')
    const [statusResult, runsResult] = await Promise.all([
      supabase.rpc('list_maintenance_job_status'),
      supabase.rpc('list_maintenance_job_runs', { p_limit: 100, p_offset: 0 }),
    ])

    if (statusResult.error) throw new Error(statusResult.error.message)
    if (runsResult.error) throw new Error(runsResult.error.message)

    return {
      jobs: Array.isArray(statusResult.data) ? statusResult.data : [],
      runs: Array.isArray(runsResult.data) ? runsResult.data : [],
    }
  } catch (error) {
    return {
      jobs: [],
      runs: [],
      error: error instanceof Error ? error.message : '유지보수 작업 상태를 불러오지 못했습니다.',
    }
  }
}
