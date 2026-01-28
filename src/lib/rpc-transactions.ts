/**
 * 데이터베이스 트랜잭션 RPC 함수 호출 헬퍼
 * Supabase PostgreSQL RPC 함수를 통한 안전한 금융 트랜잭션 처리
 */

import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// 타입 정의
// ============================================================================

export interface ChargePointsParams {
  customerId: string
  amount: number
  category: 'general' | 'betting'
  chargedBy: string
  note?: string
}

export interface DeductPointsParams {
  customerId: string
  amount: number
  category: 'general' | 'betting'
  deductedBy: string
  note?: string
}

export interface SettleBettingParams {
  taskItemId: string
  isWin: boolean
  payout?: number
  settledBy: string
}

export interface ApproveTaskParams {
  taskId: string
  approvedBy: string
  deductAmount?: number
  category?: 'general' | 'betting'
}

export interface ProcessRefundParams {
  taskItemId: string
  refundAmount: number
  category: 'general' | 'betting'
  processedBy: string
  reason?: string
}

export interface BulkSettleBettingParams {
  matchId: string
  winningChoice: 'home' | 'away' | 'draw'
  settledBy: string
}

export interface TransactionResult {
  success: boolean
  transaction_id?: string
  customer_id?: string
  amount?: number
  category?: string
  new_balance?: number
  timestamp?: string
  error?: string
  [key: string]: any
}

// ============================================================================
// RPC 함수 호출 헬퍼
// ============================================================================

/**
 * 포인트 충전
 * 트랜잭션 안전성 보장
 */
export async function chargePoints(
  supabase: SupabaseClient,
  params: ChargePointsParams
): Promise<TransactionResult> {
  try {
    const { data, error } = await supabase.rpc('charge_points', {
      p_customer_id: params.customerId,
      p_amount: params.amount,
      p_category: params.category,
      p_charged_by: params.chargedBy,
      p_note: params.note || null
    })

    if (error) {
      console.error('[RPC] charge_points 오류:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return data as TransactionResult
  } catch (error) {
    console.error('[RPC] charge_points 예외:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '포인트 충전 실패'
    }
  }
}

/**
 * 포인트 차감
 * 잔액 부족 시 자동으로 실패
 */
export async function deductPoints(
  supabase: SupabaseClient,
  params: DeductPointsParams
): Promise<TransactionResult> {
  try {
    const { data, error } = await supabase.rpc('deduct_points', {
      p_customer_id: params.customerId,
      p_amount: params.amount,
      p_category: params.category,
      p_deducted_by: params.deductedBy,
      p_note: params.note || null
    })

    if (error) {
      console.error('[RPC] deduct_points 오류:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return data as TransactionResult
  } catch (error) {
    console.error('[RPC] deduct_points 예외:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '포인트 차감 실패'
    }
  }
}

/**
 * 배팅 정산
 * 당첨 시 자동으로 포인트 지급
 */
export async function settleBetting(
  supabase: SupabaseClient,
  params: SettleBettingParams
): Promise<TransactionResult> {
  try {
    const { data, error } = await supabase.rpc('settle_betting', {
      p_task_item_id: params.taskItemId,
      p_is_win: params.isWin,
      p_payout: params.payout || 0,
      p_settled_by: params.settledBy
    })

    if (error) {
      console.error('[RPC] settle_betting 오류:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return data as TransactionResult
  } catch (error) {
    console.error('[RPC] settle_betting 예외:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '배팅 정산 실패'
    }
  }
}

/**
 * 티켓 승인 및 포인트 차감
 * 원자적으로 처리
 */
export async function approveTaskWithDeduction(
  supabase: SupabaseClient,
  params: ApproveTaskParams
): Promise<TransactionResult> {
  try {
    const { data, error } = await supabase.rpc('approve_task_with_deduction', {
      p_task_id: params.taskId,
      p_approved_by: params.approvedBy,
      p_deduct_amount: params.deductAmount || 0,
      p_category: params.category || 'general'
    })

    if (error) {
      console.error('[RPC] approve_task_with_deduction 오류:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return data as TransactionResult
  } catch (error) {
    console.error('[RPC] approve_task_with_deduction 예외:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '티켓 승인 실패'
    }
  }
}

/**
 * 환불 처리
 * 포인트 복구 및 상태 변경
 */
export async function processRefund(
  supabase: SupabaseClient,
  params: ProcessRefundParams
): Promise<TransactionResult> {
  try {
    const { data, error } = await supabase.rpc('process_refund', {
      p_task_item_id: params.taskItemId,
      p_refund_amount: params.refundAmount,
      p_category: params.category,
      p_processed_by: params.processedBy,
      p_reason: params.reason || null
    })

    if (error) {
      console.error('[RPC] process_refund 오류:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return data as TransactionResult
  } catch (error) {
    console.error('[RPC] process_refund 예외:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '환불 처리 실패'
    }
  }
}

/**
 * 일괄 배팅 정산
 * 한 경기의 모든 배팅을 한 번에 처리
 */
export async function bulkSettleBetting(
  supabase: SupabaseClient,
  params: BulkSettleBettingParams
): Promise<TransactionResult> {
  try {
    const { data, error } = await supabase.rpc('bulk_settle_betting', {
      p_match_id: params.matchId,
      p_winning_choice: params.winningChoice,
      p_settled_by: params.settledBy
    })

    if (error) {
      console.error('[RPC] bulk_settle_betting 오류:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return data as TransactionResult
  } catch (error) {
    console.error('[RPC] bulk_settle_betting 예외:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '일괄 배팅 정산 실패'
    }
  }
}

// ============================================================================
// 포인트 이력 조회
// ============================================================================

export interface PointHistory {
  id: string
  customer_id: string
  amount: number
  type: 'charge' | 'deduct' | 'win' | 'refund'
  category: 'general' | 'betting'
  balance_after: number
  performed_by: string
  note: string | null
  created_at: string
}

/**
 * 회원의 포인트 이력 조회
 */
export async function getPointHistory(
  supabase: SupabaseClient,
  customerId: string,
  limit: number = 50
): Promise<PointHistory[]> {
  try {
    const { data, error } = await supabase
      .from('point_history')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[DB] point_history 조회 오류:', error)
      return []
    }

    return data as PointHistory[]
  } catch (error) {
    console.error('[DB] point_history 조회 예외:', error)
    return []
  }
}

/**
 * 전체 포인트 이력 조회 (관리자용)
 */
export async function getAllPointHistory(
  supabase: SupabaseClient,
  filters?: {
    type?: string
    category?: string
    startDate?: string
    endDate?: string
  },
  limit: number = 100
): Promise<PointHistory[]> {
  try {
    let query = supabase
      .from('point_history')
      .select(`
        *,
        customer:customers!point_history_customer_id_fkey(name, member_number),
        user:users!point_history_performed_by_fkey(name, role)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filters?.type) {
      query = query.eq('type', filters.type)
    }

    if (filters?.category) {
      query = query.eq('category', filters.category)
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate)
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('[DB] point_history 전체 조회 오류:', error)
      return []
    }

    return data as any[]
  } catch (error) {
    console.error('[DB] point_history 전체 조회 예외:', error)
    return []
  }
}

// ============================================================================
// 사용 예제
// ============================================================================

/**
 * Example: 포인트 충전
 *
 * const supabase = await createClient()
 * const result = await chargePoints(supabase, {
 *   customerId: 'uuid-here',
 *   amount: 10000,
 *   category: 'general',
 *   chargedBy: 'user-uuid',
 *   note: '관리자 충전'
 * })
 *
 * if (result.success) {
 *   console.log('충전 완료:', result.new_balance)
 * } else {
 *   console.error('충전 실패:', result.error)
 * }
 */

/**
 * Example: 배팅 정산
 *
 * const result = await settleBetting(supabase, {
 *   taskItemId: 'task-item-uuid',
 *   isWin: true,
 *   payout: 50000,
 *   settledBy: 'user-uuid'
 * })
 */

/**
 * Example: 일괄 배팅 정산
 *
 * const result = await bulkSettleBetting(supabase, {
 *   matchId: 'match-uuid',
 *   winningChoice: 'home',
 *   settledBy: 'user-uuid'
 * })
 *
 * console.log('정산 결과:', result.total_wins, '명 당첨')
 */
