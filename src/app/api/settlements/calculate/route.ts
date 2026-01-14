import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

/**
 * POST /api/settlements/calculate
 * 월말 정산 계산
 * 매출 - 원가 - 배송비 = 순수익 자동 계산
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
        { error: "연도와 월을 입력해주세요." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 해당 월의 날짜 범위 계산
    const startDate = new Date(year, month - 1, 1)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(year, month, 0)
    endDate.setHours(23, 59, 59, 999)

    // 이미 정산된 내역이 있는지 확인
    const { data: existingSettlement } = await supabase
      .from("settlements")
      .select("*")
      .eq("settlement_year", year)
      .eq("settlement_month", month)
      .single()

    if (existingSettlement) {
      return NextResponse.json(
        { error: "이미 정산된 내역이 있습니다." },
        { status: 400 }
      )
    }

    // 1. 매출 계산 (포인트 충전 합계)
    const { data: chargeTransactions } = await supabase
      .from("points")
      .select("amount")
      .eq("type", "charge")
      .eq("status", "approved")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())

    const revenue = chargeTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0

    // 2. 포인트 환불 (매출에서 차감)
    const { data: refundTransactions } = await supabase
      .from("points")
      .select("amount")
      .eq("type", "refund")
      .eq("status", "approved")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())

    const refunds = refundTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0

    // 3. 원가 계산 (task_items에서 계산)
    const { data: taskItems } = await supabase
      .from("task_items")
      .select("amount, details")
      .in("status", ["completed", "shipped"])
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())

    let totalCost = 0
    taskItems?.forEach((item: any) => {
      // details에 cost 정보가 있으면 사용, 없으면 amount의 70%로 추정
      if (item.details && typeof item.details === "object" && item.details.cost) {
        totalCost += item.details.cost
      } else {
        totalCost += item.amount * 0.7 // 추정 원가율 70%
      }
    })

    // 4. 배송비 계산
    const { data: shippingRecords } = await supabase
      .from("logistics_items")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())

    const shippingCost = (shippingRecords?.length || 0) * 4000 // 개당 4,000원 가정

    // 5. 재고 소모품 비용
    const { data: inventoryUse } = await supabase
      .from("inventory_transactions")
      .select("inventory:inventory!inventory_transactions_inventory_id_fkey(unit_cost), quantity")
      .eq("transaction_type", "use")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())

    let suppliesCost = 0
    inventoryUse?.forEach((record: any) => {
      if (record.inventory?.unit_cost) {
        suppliesCost += record.inventory.unit_cost * record.quantity
      }
    })

    // 순수익 계산
    const netRevenue = revenue - refunds
    const totalExpenses = totalCost + shippingCost + suppliesCost
    const netProfit = netRevenue - totalExpenses

    // 정산 내역 저장
    const { data: settlement, error: insertError } = await supabase
      .from("settlements")
      .insert({
        settlement_year: year,
        settlement_month: month,
        revenue: netRevenue,
        cost: totalCost,
        shipping_cost: shippingCost,
        supplies_cost: suppliesCost,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        refunds: refunds,
        calculated_by: user.id,
        calculation_details: {
          charge_count: chargeTransactions?.length || 0,
          refund_count: refundTransactions?.length || 0,
          task_items_count: taskItems?.length || 0,
          shipping_count: shippingRecords?.length || 0,
          date_range: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
        },
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating settlement:", insertError)
      return NextResponse.json(
        { error: "정산 내역 생성에 실패했습니다." },
        { status: 500 }
      )
    }

    // 감사 로그
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "calculate_settlement",
      table_name: "settlements",
      record_id: settlement.id,
      changes: { settlement },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "정산이 완료되었습니다.",
      settlement: {
        ...settlement,
        profitMargin: netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(2) : 0,
      },
    })
  } catch (error: any) {
    console.error("Settlement calculate API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
