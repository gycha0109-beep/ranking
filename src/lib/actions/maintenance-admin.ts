'use server'

import { requireAdminCapability } from '@/lib/actions/admin-access'

type MaintenanceAdminData = {
  jobs: Array<Record<string, unknown>>
  runs: Array<Record<string, unknown>>
  error?: string
}

export async function loadMaintenanceAdminData(): Promise<MaintenanceAdminData> {
  try {
    const supabase = await requireAdminCapability('audit_view')
    const [statusResult, runsResult] = await Promise.all([
      supabase.rpc('list_maintenance_job_status'),
      supabase.rpc('list_maintenance_job_runs', { p_limit: 100, p_offset: 0 }),
    ])

    if (statusResult.error) throw new Error(statusResult.error.message)
    if (runsResult.error) throw new Error(runsResult.error.message)

    return {
      jobs: Array.isArray(statusResult.data) ? statusResult.data as Array<Record<string, unknown>> : [],
      runs: Array.isArray(runsResult.data) ? runsResult.data as Array<Record<string, unknown>> : [],
    }
  } catch (error) {
    return {
      jobs: [],
      runs: [],
      error: error instanceof Error ? error.message : '유지보수 작업 상태를 불러오지 못했습니다.',
    }
  }
}
