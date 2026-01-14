import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkAdminAccess } from "@/lib/.cursorrules/admin"

/**
 * POST /api/admin/cleanup
 * 시스템 데이터 청소 API
 *
 * 쓰레기 데이터를 정리하고 시스템을 최적화합니다.
 *
 * Body:
 * - cleanupType: 'orphaned_files' | 'old_logs' | 'temp_data'
 * - daysOld?: number (기본값: 30) - 며칠 이전 데이터를 정리할지
 *
 * 권한: admin만
 */
export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const { isAdmin, userId } = await checkAdminAccess()
    if (!isAdmin || !userId) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { cleanupType, daysOld = 30 } = body as {
      cleanupType: "orphaned_files" | "old_logs" | "temp_data"
      daysOld?: number
    }

    if (!cleanupType) {
      return NextResponse.json(
        { error: "정리 유형을 선택해주세요." },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    let cleanupResult = {
      type: cleanupType,
      deletedCount: 0,
      freedSpace: 0,
      details: {} as any,
      errors: [] as string[],
    }

    switch (cleanupType) {
      case "orphaned_files":
        cleanupResult = await cleanupOrphanedFiles(supabase, cutoffDate)
        break

      case "old_logs":
        cleanupResult = await cleanupOldLogs(supabase, cutoffDate)
        break

      case "temp_data":
        cleanupResult = await cleanupTempData(supabase, cutoffDate)
        break

      default:
        return NextResponse.json(
          { error: "지원하지 않는 정리 유형입니다." },
          { status: 400 }
        )
    }

    // 감사 로그 기록
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "cleanup",
      table_name: "system",
      record_id: null,
      changes: {
        cleanup_type: cleanupType,
        days_old: daysOld,
        result: cleanupResult,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    })

    return NextResponse.json({
      success: true,
      message: "데이터 정리가 완료되었습니다.",
      result: cleanupResult,
    })
  } catch (error: any) {
    console.error("Cleanup error:", error)
    return NextResponse.json(
      { error: "데이터 정리 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * 고아 파일 정리
 * DB에 레코드는 없지만 Storage에는 남아있는 파일 삭제
 */
async function cleanupOrphanedFiles(supabase: any, cutoffDate: Date) {
  const result = {
    type: "orphaned_files" as const,
    deletedCount: 0,
    freedSpace: 0,
    details: {
      buckets: {} as Record<string, { deleted: number; size: number }>,
    },
    errors: [] as string[],
  }

  try {
    // Storage 버킷 목록 조회
    const { data: buckets } = await supabase.storage.listBuckets()

    for (const bucket of buckets || []) {
      try {
        // 버킷 내 모든 파일 조회
        const { data: files } = await supabase.storage.from(bucket.name).list()

        if (!files || files.length === 0) continue

        result.details.buckets[bucket.name] = { deleted: 0, size: 0 }

        for (const file of files) {
          // 파일 생성일이 cutoffDate 이전인지 확인
          const fileDate = new Date(file.created_at)
          if (fileDate >= cutoffDate) continue

          // 파일이 DB에 참조되어 있는지 확인
          // 예: letters 테이블의 image_url에 파일명이 있는지
          const { data: references } = await supabase
            .from("letters")
            .select("id")
            .ilike("image_url", `%${file.name}%`)
            .limit(1)

          // 참조가 없으면 고아 파일
          if (!references || references.length === 0) {
            // 파일 삭제
            const { error: deleteError } = await supabase.storage
              .from(bucket.name)
              .remove([file.name])

            if (!deleteError) {
              result.deletedCount++
              result.details.buckets[bucket.name].deleted++
              result.details.buckets[bucket.name].size += file.metadata?.size || 0
              result.freedSpace += file.metadata?.size || 0
            } else {
              result.errors.push(`Failed to delete ${file.name}: ${deleteError.message}`)
            }
          }
        }
      } catch (error: any) {
        result.errors.push(`Error processing bucket ${bucket.name}: ${error.message}`)
      }
    }
  } catch (error: any) {
    result.errors.push(`Error listing buckets: ${error.message}`)
  }

  return result
}

/**
 * 오래된 로그 정리
 */
async function cleanupOldLogs(supabase: any, cutoffDate: Date) {
  const result = {
    type: "old_logs" as const,
    deletedCount: 0,
    freedSpace: 0,
    details: {
      audit_logs: 0,
      system_logs: 0,
    },
    errors: [] as string[],
  }

  try {
    // audit_logs 정리
    const { data: oldAuditLogs, error: auditError } = await supabase
      .from("audit_logs")
      .delete()
      .lt("created_at", cutoffDate.toISOString())
      .select("id")

    if (auditError) {
      result.errors.push(`Audit logs cleanup error: ${auditError.message}`)
    } else {
      result.details.audit_logs = oldAuditLogs?.length || 0
      result.deletedCount += oldAuditLogs?.length || 0
    }

    // 기타 시스템 로그 테이블이 있다면 추가
    // 예: system_logs, error_logs 등
  } catch (error: any) {
    result.errors.push(`Error cleaning logs: ${error.message}`)
  }

  return result
}

/**
 * 임시 데이터 정리
 */
async function cleanupTempData(supabase: any, cutoffDate: Date) {
  const result = {
    type: "temp_data" as const,
    deletedCount: 0,
    freedSpace: 0,
    details: {
      expired_sessions: 0,
      temp_uploads: 0,
      cancelled_transactions: 0,
    },
    errors: [] as string[],
  }

  try {
    // 만료된 세션 데이터 정리 (있다면)
    // 취소된 오래된 거래 정리
    const { data: cancelledTransactions, error: transactionError } = await supabase
      .from("transactions")
      .delete()
      .eq("status", "cancelled")
      .lt("created_at", cutoffDate.toISOString())
      .select("id")

    if (transactionError) {
      result.errors.push(`Transaction cleanup error: ${transactionError.message}`)
    } else {
      result.details.cancelled_transactions = cancelledTransactions?.length || 0
      result.deletedCount += cancelledTransactions?.length || 0
    }

    // 임시 업로드 파일 정리
    // 예: 업로드는 했지만 실제로 사용되지 않은 이미지들
  } catch (error: any) {
    result.errors.push(`Error cleaning temp data: ${error.message}`)
  }

  return result
}

/**
 * GET /api/admin/cleanup
 * 정리 가능한 데이터 통계 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const { isAdmin } = await checkAdminAccess()
    if (!isAdmin) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const daysOld = parseInt(searchParams.get("daysOld") || "30")

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    // 정리 가능한 데이터 통계
    const stats = {
      old_logs_count: 0,
      temp_data_count: 0,
    }

    // 오래된 감사 로그 개수
    const { count: oldLogsCount } = await supabase
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate.toISOString())

    stats.old_logs_count = oldLogsCount || 0

    // 취소된 오래된 거래 개수
    const { count: cancelledCount } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "cancelled")
      .lt("created_at", cutoffDate.toISOString())

    stats.temp_data_count = cancelledCount || 0

    return NextResponse.json({
      success: true,
      stats,
      daysOld,
      cutoffDate: cutoffDate.toISOString(),
    })
  } catch (error: any) {
    console.error("Get cleanup stats error:", error)
    return NextResponse.json(
      { error: "통계 조회 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
