import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkAdminAccess } from "@/lib/.cursorrules/admin"

/**
 * GET /api/audit-logs
 * 감사 로그 조회 (필터링 지원)
 * 권한: admin만
 */
export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const { isAdmin: hasAdminAccess } = await checkAdminAccess()
    if (!hasAdminAccess) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // 필터 파라미터
    const userId = searchParams.get("userId")
    const tableName = searchParams.get("tableName")
    const action = searchParams.get("action")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")

    // 기본 쿼리
    let query = supabase
      .from("audit_logs")
      .select(
        `
        id,
        user_id,
        action,
        table_name,
        record_id,
        changes,
        ip_address,
        created_at,
        users:users!audit_logs_user_id_fkey (
          id,
          username,
          email,
          role
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })

    // 필터 적용
    if (userId) {
      query = query.eq("user_id", userId)
    }

    if (tableName) {
      query = query.eq("table_name", tableName)
    }

    if (action) {
      query = query.eq("action", action)
    }

    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      query = query.gte("created_at", start.toISOString())
    }

    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query = query.lte("created_at", end.toISOString())
    }

    // 페이지네이션
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching audit logs:", error)
      return NextResponse.json(
        { error: "감사 로그를 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    // 통계 정보 추가 계산
    let statsQuery = supabase.from("audit_logs").select("action", { count: "exact" })

    if (userId) statsQuery = statsQuery.eq("user_id", userId)
    if (tableName) statsQuery = statsQuery.eq("table_name", tableName)
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      statsQuery = statsQuery.gte("created_at", start.toISOString())
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      statsQuery = statsQuery.lte("created_at", end.toISOString())
    }

    const { count: totalCount } = await statsQuery

    return NextResponse.json({
      success: true,
      logs: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      stats: {
        totalLogs: totalCount || 0,
      },
    })
  } catch (error: any) {
    console.error("Audit logs API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
