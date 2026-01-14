/**
 * 감사 로그 자동 기록 미들웨어
 *
 * 모든 DB 변경 작업(INSERT, UPDATE, DELETE)을 자동으로 audit_logs 테이블에 기록합니다.
 * 사용자 ID, 테이블명, 변경 전후 값 등을 추적합니다.
 */

import { SupabaseClient } from "@supabase/supabase-js"

export type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "custom"

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

/**
 * 감사 로그 기록
 */
export async function logAudit(
  supabase: SupabaseClient,
  options: AuditLogOptions
): Promise<void> {
  try {
    const changes: Record<string, any> = {}

    if (options.oldValue !== undefined) {
      changes.old = options.oldValue
    }

    if (options.newValue !== undefined) {
      changes.new = options.newValue
    }

    // 변경사항 비교 (update의 경우)
    if (options.action === "update" && options.oldValue && options.newValue) {
      const diff: Record<string, { old: any; new: any }> = {}

      for (const key in options.newValue) {
        if (options.oldValue[key] !== options.newValue[key]) {
          diff[key] = {
            old: options.oldValue[key],
            new: options.newValue[key],
          }
        }
      }

      if (Object.keys(diff).length > 0) {
        changes.diff = diff
      }
    }

    // 메타데이터 추가
    if (options.metadata) {
      changes.metadata = options.metadata
    }

    await supabase.from("audit_logs").insert({
      user_id: options.userId,
      action: options.action,
      table_name: options.tableName,
      record_id: options.recordId?.toString() || null,
      changes,
      ip_address: options.ipAddress || "unknown",
      user_agent: options.userAgent,
    })
  } catch (error) {
    console.error("Failed to log audit:", error)
    // 감사 로그 실패가 원래 작업을 방해하지 않도록 에러를 던지지 않음
  }
}

/**
 * DB 변경 작업 래퍼 - CREATE
 */
export async function auditedInsert<T = any>(
  supabase: SupabaseClient,
  tableName: string,
  data: any,
  userId: string,
  ipAddress?: string
): Promise<{ data: T | null; error: any }> {
  const { data: insertedData, error } = await supabase
    .from(tableName)
    .insert(data)
    .select()
    .single()

  if (!error && insertedData) {
    await logAudit(supabase, {
      userId,
      action: "create",
      tableName,
      recordId: insertedData.id,
      newValue: insertedData,
      ipAddress,
    })
  }

  return { data: insertedData, error }
}

/**
 * DB 변경 작업 래퍼 - UPDATE
 */
export async function auditedUpdate<T = any>(
  supabase: SupabaseClient,
  tableName: string,
  recordId: string | number,
  data: any,
  userId: string,
  ipAddress?: string
): Promise<{ data: T | null; error: any }> {
  // 변경 전 데이터 조회
  const { data: oldData } = await supabase
    .from(tableName)
    .select("*")
    .eq("id", recordId)
    .single()

  // 업데이트 실행
  const { data: updatedData, error } = await supabase
    .from(tableName)
    .update(data)
    .eq("id", recordId)
    .select()
    .single()

  if (!error && updatedData) {
    await logAudit(supabase, {
      userId,
      action: "update",
      tableName,
      recordId,
      oldValue: oldData,
      newValue: updatedData,
      ipAddress,
    })
  }

  return { data: updatedData, error }
}

/**
 * DB 변경 작업 래퍼 - DELETE
 */
export async function auditedDelete(
  supabase: SupabaseClient,
  tableName: string,
  recordId: string | number,
  userId: string,
  ipAddress?: string
): Promise<{ error: any }> {
  // 삭제 전 데이터 조회
  const { data: oldData } = await supabase
    .from(tableName)
    .select("*")
    .eq("id", recordId)
    .single()

  // 삭제 실행
  const { error } = await supabase.from(tableName).delete().eq("id", recordId)

  if (!error) {
    await logAudit(supabase, {
      userId,
      action: "delete",
      tableName,
      recordId,
      oldValue: oldData,
      ipAddress,
    })
  }

  return { error }
}

/**
 * 대량 삽입 (Bulk Insert) with Audit
 */
export async function auditedBulkInsert<T = any>(
  supabase: SupabaseClient,
  tableName: string,
  dataArray: any[],
  userId: string,
  ipAddress?: string
): Promise<{ data: T[] | null; error: any }> {
  const { data: insertedData, error } = await supabase
    .from(tableName)
    .insert(dataArray)
    .select()

  if (!error && insertedData) {
    await logAudit(supabase, {
      userId,
      action: "create",
      tableName,
      recordId: null,
      newValue: {
        count: insertedData.length,
        ids: insertedData.map((item: any) => item.id),
      },
      ipAddress,
      metadata: {
        bulk_operation: true,
        item_count: insertedData.length,
      },
    })
  }

  return { data: insertedData, error }
}

/**
 * 조건부 대량 업데이트 with Audit
 */
export async function auditedBulkUpdate(
  supabase: SupabaseClient,
  tableName: string,
  filterColumn: string,
  filterValue: any,
  data: any,
  userId: string,
  ipAddress?: string
): Promise<{ data: any[] | null; error: any }> {
  // 변경될 레코드들 조회
  const { data: oldData } = await supabase
    .from(tableName)
    .select("*")
    .eq(filterColumn, filterValue)

  // 업데이트 실행
  const { data: updatedData, error } = await supabase
    .from(tableName)
    .update(data)
    .eq(filterColumn, filterValue)
    .select()

  if (!error && updatedData) {
    await logAudit(supabase, {
      userId,
      action: "update",
      tableName,
      recordId: null,
      oldValue: {
        count: oldData?.length || 0,
        filter: { [filterColumn]: filterValue },
      },
      newValue: {
        count: updatedData.length,
        ids: updatedData.map((item: any) => item.id),
      },
      ipAddress,
      metadata: {
        bulk_operation: true,
        item_count: updatedData.length,
      },
    })
  }

  return { data: updatedData, error }
}

/**
 * 커스텀 액션 로깅
 * 표준 CRUD가 아닌 특수한 작업을 로깅할 때 사용
 */
export async function logCustomAction(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  details: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  await logAudit(supabase, {
    userId,
    action: "custom",
    tableName: "custom_actions",
    recordId: null,
    metadata: {
      custom_action: action,
      ...details,
    },
    ipAddress,
  })
}

/**
 * Request에서 IP 주소 추출
 */
export function getIpFromRequest(request: Request): string {
  const headers = request.headers
  const forwardedFor = headers.get("x-forwarded-for")
  const realIp = headers.get("x-real-ip")
  const cfConnectingIp = headers.get("cf-connecting-ip")

  return cfConnectingIp || forwardedFor?.split(",")[0] || realIp || "unknown"
}

/**
 * Request에서 User Agent 추출
 */
export function getUserAgentFromRequest(request: Request): string | undefined {
  return request.headers.get("user-agent") || undefined
}
