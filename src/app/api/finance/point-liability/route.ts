import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkAdminAccess } from "@/lib/.cursorrules/admin"

/**
 * GET /api/finance/point-liability
 * 포인트 부채 현황 조회
 *
 * 전체 고객의 포인트 잔액 합계를 조회하여 회사가 지급해야 할
 * 포인트 부채 규모를 파악합니다. 은행 계좌 잔액과 비교하여
 * 재무 건전성을 확인할 수 있습니다.
 *
 * 권한: admin만
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

    // 전체 고객의 일반 포인트와 베팅 포인트 합계 조회
    const { data: pointSummary, error: summaryError } = await supabase
      .from("customers")
      .select("total_point_general, total_point_betting")

    if (summaryError) {
      console.error("Error fetching point summary:", summaryError)
      return NextResponse.json(
        { error: "포인트 데이터를 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    // 합계 계산
    let totalGeneralPoints = 0
    let totalBettingPoints = 0
    let totalPoints = 0
    let customerCount = 0

    if (pointSummary && pointSummary.length > 0) {
      customerCount = pointSummary.length

      for (const customer of pointSummary) {
        const generalPoints = customer.total_point_general || 0
        const bettingPoints = customer.total_point_betting || 0

        totalGeneralPoints += generalPoints
        totalBettingPoints += bettingPoints
        totalPoints += generalPoints + bettingPoints
      }
    }

    // 포인트별 통계
    const { data: customerStats } = await supabase
      .from("customers")
      .select("id, name, total_point_general, total_point_betting")
      .gt("total_point_general", 0)
      .or("total_point_betting.gt.0")
      .order("total_point_general", { ascending: false })
      .limit(10)

    // 최근 포인트 거래 내역
    const { data: recentTransactions } = await supabase
      .from("point_transactions")
      .select(
        `
        id,
        customer_id,
        amount,
        point_type,
        transaction_type,
        created_at,
        customers (
          id,
          name,
          customer_code
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(20)

    // 일별 포인트 변동 (최근 7일)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: dailyChanges } = await supabase
      .from("point_transactions")
      .select("amount, point_type, created_at")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: true })

    // 일별로 집계
    const dailyStats: Record<
      string,
      { date: string; added: number; deducted: number; net: number }
    > = {}

    if (dailyChanges) {
      for (const transaction of dailyChanges) {
        const date = transaction.created_at.split("T")[0]
        if (!dailyStats[date]) {
          dailyStats[date] = { date, added: 0, deducted: 0, net: 0 }
        }

        const amount = transaction.amount || 0
        if (amount > 0) {
          dailyStats[date].added += amount
        } else {
          dailyStats[date].deducted += Math.abs(amount)
        }
        dailyStats[date].net += amount
      }
    }

    // 환산 가치 (1포인트 = 1원 가정)
    const liability = {
      total: totalPoints,
      general: totalGeneralPoints,
      betting: totalBettingPoints,
      customerCount,
      averagePerCustomer: customerCount > 0 ? Math.round(totalPoints / customerCount) : 0,
    }

    return NextResponse.json({
      success: true,
      liability,
      topCustomers: customerStats?.map((c) => ({
        id: c.id,
        name: c.name,
        generalPoints: c.total_point_general || 0,
        bettingPoints: c.total_point_betting || 0,
        totalPoints: (c.total_point_general || 0) + (c.total_point_betting || 0),
      })),
      recentTransactions: recentTransactions?.map((t) => ({
        id: t.id,
        customerId: t.customer_id,
        customerName: t.customers?.name,
        customerCode: t.customers?.customer_code,
        amount: t.amount,
        pointType: t.point_type,
        transactionType: t.transaction_type,
        createdAt: t.created_at,
      })),
      dailyStats: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Point liability API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/finance/point-liability
 * 포인트 부채 리포트 생성
 *
 * Body:
 * - format?: 'json' | 'csv' (기본값: json)
 * - includeCustomers?: boolean (고객별 상세 포함 여부, 기본값: false)
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
    const { format = "json", includeCustomers = false } = body

    const supabase = await createClient()

    // 전체 고객 포인트 데이터 조회
    let query = supabase
      .from("customers")
      .select("id, name, customer_code, total_point_general, total_point_betting")

    if (!includeCustomers) {
      query = query.limit(100) // 간단한 리포트는 상위 100명만
    }

    const { data: customers, error } = await query

    if (error) {
      console.error("Error generating report:", error)
      return NextResponse.json(
        { error: "리포트 생성에 실패했습니다." },
        { status: 500 }
      )
    }

    // 통계 계산
    let totalGeneral = 0
    let totalBetting = 0

    const customerData = customers?.map((c) => {
      const general = c.total_point_general || 0
      const betting = c.total_point_betting || 0
      totalGeneral += general
      totalBetting += betting

      return {
        id: c.id,
        name: c.name,
        code: c.customer_code,
        generalPoints: general,
        bettingPoints: betting,
        totalPoints: general + betting,
      }
    })

    const report = {
      generatedAt: new Date().toISOString(),
      generatedBy: userId,
      summary: {
        totalLiability: totalGeneral + totalBetting,
        totalGeneral,
        totalBetting,
        customerCount: customers?.length || 0,
      },
      customers: includeCustomers ? customerData : undefined,
    }

    // 감사 로그 기록
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "generate_report",
      table_name: "point_liability",
      record_id: null,
      changes: {
        format,
        include_customers: includeCustomers,
        total_liability: totalGeneral + totalBetting,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    })

    return NextResponse.json({
      success: true,
      report,
    })
  } catch (error: any) {
    console.error("Generate point liability report error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
