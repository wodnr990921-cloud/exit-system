/**
 * API 응답 타입 정의
 */

// ============================================
// 1. Impersonation API Types
// ============================================

export interface ImpersonateRequest {
  targetUserId: string
}

export interface ImpersonateResponse {
  success: true
  message: string
  impersonatedUser: {
    id: string
    username: string
    name: string | null
    role: string
  }
  originalUser: {
    id: string
    username: string
  }
}

export interface ImpersonateStatusResponse {
  isImpersonating: boolean
  originalUser?: {
    id: string
    username: string
    name: string | null
    role: string
  }
  currentUser?: {
    id: string
    username: string
    name: string | null
    role: string
  }
}

export interface StopImpersonateResponse {
  success: true
  message: string
  user: {
    id: string
    username: string
    name: string | null
    role: string
  }
}

// ============================================
// 2. Notice Popup API Types
// ============================================

export interface Notice {
  id: string
  title: string
  content: string
  is_popup: boolean
  is_active: boolean
  start_date: string
  end_date: string | null
  priority: number
  created_by?: string
  created_at: string
  updated_at?: string
}

export interface GetPopupNoticesResponse {
  success: true
  notices: Notice[]
  count: number
}

export interface CreateNoticeRequest {
  title: string
  content: string
  start_date: string
  end_date?: string
  priority?: number
}

export interface CreateNoticeResponse {
  success: true
  message: string
  notice: Notice
}

export interface DismissNoticeRequest {
  noticeId: string
}

export interface DismissNoticeResponse {
  success: true
  message: string
}

// ============================================
// 3. Cleanup API Types
// ============================================

export type CleanupType = "orphaned_files" | "old_logs" | "temp_data"

export interface CleanupRequest {
  cleanupType: CleanupType
  daysOld?: number
}

export interface CleanupResult {
  type: CleanupType
  deletedCount: number
  freedSpace: number
  details: Record<string, any>
  errors: string[]
}

export interface CleanupResponse {
  success: true
  message: string
  result: CleanupResult
}

export interface CleanupStatsResponse {
  success: true
  stats: {
    old_logs_count: number
    temp_data_count: number
  }
  daysOld: number
  cutoffDate: string
}

// ============================================
// 4. Point Liability API Types
// ============================================

export interface PointLiability {
  total: number
  general: number
  betting: number
  customerCount: number
  averagePerCustomer: number
}

export interface TopCustomer {
  id: string
  name: string | null
  generalPoints: number
  bettingPoints: number
  totalPoints: number
}

export interface PointTransaction {
  id: string
  customerId: string
  customerName?: string | null
  customerCode?: string | null
  amount: number
  pointType: string
  transactionType: string
  createdAt: string
}

export interface DailyStat {
  date: string
  added: number
  deducted: number
  net: number
}

export interface PointLiabilityResponse {
  success: true
  liability: PointLiability
  topCustomers: TopCustomer[]
  recentTransactions: PointTransaction[]
  dailyStats: DailyStat[]
  generatedAt: string
}

export interface GenerateReportRequest {
  format?: "json" | "csv"
  includeCustomers?: boolean
}

export interface PointLiabilityReport {
  generatedAt: string
  generatedBy: string
  summary: {
    totalLiability: number
    totalGeneral: number
    totalBetting: number
    customerCount: number
  }
  customers?: Array<{
    id: string
    name: string | null
    code: string | null
    generalPoints: number
    bettingPoints: number
    totalPoints: number
  }>
}

export interface GenerateReportResponse {
  success: true
  report: PointLiabilityReport
}

// ============================================
// 5. Sports Crawling API Types
// ============================================

export type LeagueCode = "kbo" | "mlb" | "kleague" | "epl" | "kbl" | "nba"
export type CrawlType = "schedule" | "result"
export type GameStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled"

export interface CrawlNaverRequest {
  league?: LeagueCode
  type?: CrawlType
  saveToDb?: boolean
}

export interface CrawledGame {
  league: string
  homeTeam: string
  awayTeam: string
  homeScore?: number
  awayScore?: number
  gameDate: string
  gameTime?: string
  status: GameStatus
  location?: string
  resultScore?: string
}

export interface CrawlNaverResponse {
  success: true
  message: string
  stats: {
    total: number
    saved: number
    updated: number
    skipped: number
  }
  games: CrawledGame[]
}

export interface LeagueInfo {
  code: string
  name: string
  sport: string
}

export interface GetLeaguesResponse {
  success: true
  leagues: LeagueInfo[]
}

// ============================================
// 6. Audit Logger Types
// ============================================

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "impersonate_start"
  | "impersonate_stop"
  | "cleanup"
  | "generate_report"
  | "custom"

export interface AuditLogOptions {
  userId: string
  action: AuditAction
  tableName: string
  recordId?: string | number | null
  oldValue?: any
  newValue?: any
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
}

export interface AuditLog {
  id: string
  user_id: string
  action: AuditAction
  table_name: string
  record_id: string | null
  changes: Record<string, any>
  ip_address: string
  user_agent?: string | null
  created_at: string
}

// ============================================
// Common Types
// ============================================

export interface ApiError {
  error: string
  details?: string
}

export interface ApiSuccess<T = any> {
  success: true
  [key: string]: any
}

export type ApiResponse<T> = T | ApiError

// Type guards
export function isApiError(response: any): response is ApiError {
  return "error" in response
}

export function isApiSuccess<T>(response: ApiResponse<T>): response is T {
  return !isApiError(response)
}
