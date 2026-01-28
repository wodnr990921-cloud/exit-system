/**
 * Audit Logger Library
 *
 * Provides TypeScript utilities for creating and querying audit logs
 *
 * Usage:
 * ```typescript
 * import { logAuditAction, getAuditLogs, AuditActionType } from '@/lib/audit-logger'
 *
 * // Log an action
 * await logAuditAction(supabase, {
 *   actionType: 'point_charge',
 *   actionCategory: 'finance',
 *   description: '회원에게 10000 포인트 충전',
 *   performedBy: userId,
 *   targetType: 'customer',
 *   targetId: customerId,
 *   targetIdentifier: 'M-0012',
 *   newValue: { amount: 10000, category: 'general' }
 * })
 *
 * // Query audit logs
 * const logs = await getAuditLogs(supabase, { category: 'finance', limit: 50 })
 * ```
 */

import { SupabaseClient } from "@supabase/supabase-js"

// ============================================================================
// Types
// ============================================================================

export type AuditActionCategory =
  | 'finance'    // Point charges, deductions, settlements
  | 'task'       // Task creation, approval, status changes
  | 'betting'    // Betting creation, settlement
  | 'user'       // User management
  | 'system'     // System-level changes
  | 'procurement' // Procurement/purchase orders
  | 'logistics'  // Shipping and delivery
  | 'qa'         // Q&A and answers

export type AuditActionType =
  // Finance actions
  | 'point_charge'
  | 'point_deduct'
  | 'refund_process'
  | 'settlement_approve'

  // Task actions
  | 'task_create'
  | 'task_assign'
  | 'task_approve'
  | 'task_reject'
  | 'task_complete'
  | 'task_cancel'

  // Betting actions
  | 'betting_create'
  | 'betting_settle'
  | 'betting_cancel'

  // User actions
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'user_role_change'
  | 'user_login'
  | 'user_logout'

  // Procurement actions
  | 'procurement_order'
  | 'procurement_update'
  | 'procurement_complete'

  // Logistics actions
  | 'label_generate'
  | 'shipment_create'

  // System actions
  | 'daily_closing'
  | 'pdf_generate'
  | 'system_config_change'

export type AuditStatus = 'success' | 'failed' | 'partial'

export interface AuditLogParams {
  actionType: AuditActionType | string
  actionCategory: AuditActionCategory
  description: string
  performedBy: string // user UUID
  targetType?: string
  targetId?: string
  targetIdentifier?: string // human-readable ID like ticket_no
  oldValue?: Record<string, any>
  newValue?: Record<string, any>
  metadata?: Record<string, any>
  status?: AuditStatus
  errorMessage?: string
}

export interface AuditLog {
  id: string
  action_type: string
  action_category: string
  description: string
  performed_by: string
  performed_by_role: string | null
  performed_by_name: string | null
  target_type: string | null
  target_id: string | null
  target_identifier: string | null
  old_value: Record<string, any> | null
  new_value: Record<string, any> | null
  metadata: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
  status: string
  error_message: string | null
  created_at: string
}

export interface AuditLogQueryParams {
  category?: AuditActionCategory
  actionType?: AuditActionType | string
  performedBy?: string
  targetType?: string
  targetId?: string
  status?: AuditStatus
  dateFrom?: Date
  dateTo?: Date
  limit?: number
  offset?: number
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Log an audit action
 *
 * @param supabase - Supabase client
 * @param params - Audit log parameters
 * @returns The created audit log ID or null if failed
 */
export async function logAuditAction(
  supabase: SupabaseClient,
  params: AuditLogParams
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('create_audit_log', {
      p_action_type: params.actionType,
      p_action_category: params.actionCategory,
      p_description: params.description,
      p_performed_by: params.performedBy,
      p_target_type: params.targetType || null,
      p_target_id: params.targetId || null,
      p_target_identifier: params.targetIdentifier || null,
      p_old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
      p_new_value: params.newValue ? JSON.stringify(params.newValue) : null,
      p_metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      p_status: params.status || 'success',
      p_error_message: params.errorMessage || null,
    })

    if (error) {
      console.error('[AUDIT] Failed to create audit log:', error)
      return null
    }

    return data as string
  } catch (error) {
    console.error('[AUDIT] Exception creating audit log:', error)
    return null
  }
}

/**
 * Query audit logs
 *
 * @param supabase - Supabase client
 * @param params - Query parameters
 * @returns Array of audit logs
 */
export async function getAuditLogs(
  supabase: SupabaseClient,
  params: AuditLogQueryParams = {}
): Promise<AuditLog[]> {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters
    if (params.category) {
      query = query.eq('action_category', params.category)
    }

    if (params.actionType) {
      query = query.eq('action_type', params.actionType)
    }

    if (params.performedBy) {
      query = query.eq('performed_by', params.performedBy)
    }

    if (params.targetType) {
      query = query.eq('target_type', params.targetType)
    }

    if (params.targetId) {
      query = query.eq('target_id', params.targetId)
    }

    if (params.status) {
      query = query.eq('status', params.status)
    }

    if (params.dateFrom) {
      query = query.gte('created_at', params.dateFrom.toISOString())
    }

    if (params.dateTo) {
      query = query.lte('created_at', params.dateTo.toISOString())
    }

    // Apply limit and offset
    if (params.limit) {
      query = query.limit(params.limit)
    }

    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 50) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('[AUDIT] Failed to query audit logs:', error)
      return []
    }

    return (data || []) as AuditLog[]
  } catch (error) {
    console.error('[AUDIT] Exception querying audit logs:', error)
    return []
  }
}

/**
 * Get audit trail for a specific target (customer, task, etc.)
 *
 * @param supabase - Supabase client
 * @param targetType - Type of target
 * @param targetId - ID of target
 * @param limit - Max number of logs to return
 * @returns Array of audit logs for the target
 */
export async function getAuditTrail(
  supabase: SupabaseClient,
  targetType: string,
  targetId: string,
  limit: number = 100
): Promise<AuditLog[]> {
  return getAuditLogs(supabase, {
    targetType,
    targetId,
    limit,
  })
}

/**
 * Get recent audit logs for a user
 *
 * @param supabase - Supabase client
 * @param userId - User UUID
 * @param limit - Max number of logs to return
 * @returns Array of audit logs by the user
 */
export async function getUserAuditLogs(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50
): Promise<AuditLog[]> {
  return getAuditLogs(supabase, {
    performedBy: userId,
    limit,
  })
}

/**
 * Get audit logs for a specific date range
 *
 * @param supabase - Supabase client
 * @param dateFrom - Start date
 * @param dateTo - End date
 * @param category - Optional category filter
 * @returns Array of audit logs in date range
 */
export async function getAuditLogsByDateRange(
  supabase: SupabaseClient,
  dateFrom: Date,
  dateTo: Date,
  category?: AuditActionCategory
): Promise<AuditLog[]> {
  return getAuditLogs(supabase, {
    dateFrom,
    dateTo,
    category,
    limit: 1000, // Large limit for date range queries
  })
}

/**
 * Get failed audit logs for debugging
 *
 * @param supabase - Supabase client
 * @param limit - Max number of logs to return
 * @returns Array of failed audit logs
 */
export async function getFailedAuditLogs(
  supabase: SupabaseClient,
  limit: number = 50
): Promise<AuditLog[]> {
  return getAuditLogs(supabase, {
    status: 'failed',
    limit,
  })
}

// ============================================================================
// Convenience Functions for Common Actions
// ============================================================================

/**
 * Log a point charge action
 */
export async function logPointCharge(
  supabase: SupabaseClient,
  userId: string,
  customerId: string,
  memberNumber: string,
  amount: number,
  category: 'general' | 'betting',
  balanceAfter: number,
  metadata?: Record<string, any>
): Promise<string | null> {
  return logAuditAction(supabase, {
    actionType: 'point_charge',
    actionCategory: 'finance',
    description: `${memberNumber} 회원에게 ${amount.toLocaleString()}P 충전 (${category})`,
    performedBy: userId,
    targetType: 'customer',
    targetId: customerId,
    targetIdentifier: memberNumber,
    newValue: {
      amount,
      category,
      balance_after: balanceAfter,
    },
    metadata,
  })
}

/**
 * Log a point deduction action
 */
export async function logPointDeduct(
  supabase: SupabaseClient,
  userId: string,
  customerId: string,
  memberNumber: string,
  amount: number,
  category: 'general' | 'betting',
  balanceAfter: number,
  reason: string,
  metadata?: Record<string, any>
): Promise<string | null> {
  return logAuditAction(supabase, {
    actionType: 'point_deduct',
    actionCategory: 'finance',
    description: `${memberNumber} 회원에서 ${amount.toLocaleString()}P 차감 (${category}) - ${reason}`,
    performedBy: userId,
    targetType: 'customer',
    targetId: customerId,
    targetIdentifier: memberNumber,
    newValue: {
      amount,
      category,
      balance_after: balanceAfter,
      reason,
    },
    metadata,
  })
}

/**
 * Log a task approval action
 */
export async function logTaskApprove(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  ticketNo: string,
  oldStatus: string,
  newStatus: string,
  metadata?: Record<string, any>
): Promise<string | null> {
  return logAuditAction(supabase, {
    actionType: 'task_approve',
    actionCategory: 'task',
    description: `티켓 ${ticketNo} 승인 완료`,
    performedBy: userId,
    targetType: 'task',
    targetId: taskId,
    targetIdentifier: ticketNo,
    oldValue: { status: oldStatus },
    newValue: { status: newStatus },
    metadata,
  })
}

/**
 * Log a betting settlement action
 */
export async function logBettingSettle(
  supabase: SupabaseClient,
  userId: string,
  bettingId: string,
  bettingIdentifier: string,
  result: 'win' | 'lose' | 'cancel',
  payout: number,
  metadata?: Record<string, any>
): Promise<string | null> {
  return logAuditAction(supabase, {
    actionType: 'betting_settle',
    actionCategory: 'betting',
    description: `베팅 ${bettingIdentifier} 정산 완료 (${result === 'win' ? '승리' : result === 'lose' ? '패배' : '취소'})`,
    performedBy: userId,
    targetType: 'betting',
    targetId: bettingId,
    targetIdentifier: bettingIdentifier,
    oldValue: { status: 'pending' },
    newValue: { status: result, payout },
    metadata,
  })
}

/**
 * Log a daily closing action
 */
export async function logDailyClosing(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  summary: Record<string, any>
): Promise<string | null> {
  return logAuditAction(supabase, {
    actionType: 'daily_closing',
    actionCategory: 'system',
    description: `일일 마감 처리 완료 (${date})`,
    performedBy: userId,
    targetType: 'system',
    targetIdentifier: date,
    newValue: summary,
  })
}

// ============================================================================
// Export all
// ============================================================================

export default {
  logAuditAction,
  getAuditLogs,
  getAuditTrail,
  getUserAuditLogs,
  getAuditLogsByDateRange,
  getFailedAuditLogs,
  logPointCharge,
  logPointDeduct,
  logTaskApprove,
  logBettingSettle,
  logDailyClosing,
}
