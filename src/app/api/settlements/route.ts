import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

/**
 * GET /api/settlements
 * 정산 내역 조회
 * 권한: operator 이상
 */
export async function GET(request: NextRequest) {
  try {
    // 권한 확인
    const { hasAccess } = await checkOperatorOrCEOAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year")
    const month = searchParams.get("month")

    let query = supabase
      .from("settlements")
      .select("*")
      .order("settlement_year", { ascending: false })
      .order("settlement_month", { ascending: false })

    if (year) {
      query = query.eq("settlement_year", parseInt(year))
    }

    if (month) {
      query = query.eq("settlement_month", parseInt(month))
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching settlements:", error)
      return NextResponse.json(
        { error: "정산 내역을 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    // 합계 계산
    const totalRevenue = data.reduce((sum: number, s: any) => sum + (s.revenue || 0), 0)
    const totalCost = data.reduce((sum: number, s: any) => sum + (s.cost || 0), 0)
    const totalShipping = data.reduce((sum: number, s: any) => sum + (s.shipping_cost || 0), 0)
    const totalProfit = data.reduce((sum: number, s: any) => sum + (s.net_profit || 0), 0)

    return NextResponse.json({
      success: true,
      settlements: data,
      summary: {
        totalRevenue,
        totalCost,
        totalShipping,
        totalProfit,
        profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0,
      },
    })
  } catch (error: any) {
    console.error("Settlements API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settlements
 * 정산 계산 및 저장
 * 권한: operator 이상
 */
export async function POST(request: NextRequest) {
  try {
    // 권한 확인
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { year, month } = await request.json()

    if (!year || !month) {
      return NextResponse.json(
        { error: "년도와 월을 입력해주세요." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 해당 월의 정산이 이미 존재하는지 확인
    const { data: existingSettlement } = await supabase
      .from("settlements")
      .select("id")
      .eq("settlement_year", year)
      .eq("settlement_month", month)
      .single()

    if (existingSettlement) {
      return NextResponse.json(
        { error: "해당 월의 정산이 이미 존재합니다." },
        { status: 400 }
      )
    }

    // 해당 월의 시작일과 종료일 계산
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)

    // task_items에서 해당 월의 거래 집계
    const { data: taskItems, error: taskError } = await supabase
      .from("task_items")
      .select(
        `
        id,
        revenue,
        cost,
        shipping_cost,
        profit,
        created_at,
        task:tasks!task_items_task_id_fkey (
          id,
          status
        )
      `
      )
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .eq("task.status", "completed")

    if (taskError) {
      console.error("Error fetching task items:", taskError)
      return NextResponse.json(
        { error: "거래 집계에 실패했습니다." },
        { status: 500 }
      )
    }

    // 집계 계산
    const totalRevenue = taskItems.reduce((sum: number, item: any) => sum + (item.revenue || 0), 0)
    const totalCost = taskItems.reduce((sum: number, item: any) => sum + (item.cost || 0), 0)
    const totalShipping = taskItems.reduce((sum: number, item: any) => sum + (item.shipping_cost || 0), 0)
    const totalProfit = taskItems.reduce((sum: number, item: any) => sum + (item.profit || 0), 0)
    const totalCount = taskItems.length

    // 순이익 계산 (매출 - 비용 - 배송비)
    const netProfit = totalRevenue - totalCost - totalShipping

    // 이익률 계산
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    // 평균값 계산
    const avgRevenue = totalCount > 0 ? totalRevenue / totalCount : 0
    const avgProfit = totalCount > 0 ? totalProfit / totalCount : 0

    // 정산 데이터 저장
    const { data: settlement, error: insertError } = await supabase
      .from("settlements")
      .insert({
        settlement_year: year,
        settlement_month: month,
        revenue: totalRevenue,
        cost: totalCost,
        shipping_cost: totalShipping,
        gross_profit: totalProfit,
        net_profit: netProfit,
        profit_margin: profitMargin,
        transaction_count: totalCount,
        avg_revenue: avgRevenue,
        avg_profit: avgProfit,
        settled_at: new Date().toISOString(),
        settled_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating settlement:", insertError)
      return NextResponse.json(
        { error: "정산 저장에 실패했습니다." },
        { status: 500 }
      )
    }

    // 감사 로그 생성
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_settlement",
      table_name: "settlements",
      record_id: settlement.id,
      changes: {
        settlement: settlement,
        period: { year, month },
        summary: {
          totalRevenue,
          totalCost,
          totalShipping,
          netProfit,
          profitMargin: profitMargin.toFixed(2),
          transactionCount: totalCount,
        },
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "정산이 완료되었습니다.",
      settlement,
      summary: {
        period: `${year}년 ${month}월`,
        totalRevenue,
        totalCost,
        totalShipping,
        netProfit,
        profitMargin: profitMargin.toFixed(2) + "%",
        transactionCount: totalCount,
      },
    })
  } catch (error: any) {
    console.error("Settlement create API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
