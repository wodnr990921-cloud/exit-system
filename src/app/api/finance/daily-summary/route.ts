import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0]

    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    // 일반 매출 (충전 - 일반)
    const { data: generalCharges } = await supabase
      .from("points")
      .select("amount")
      .eq("type", "charge")
      .eq("category", "general")
      .eq("status", "approved")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())

    const generalRevenue = generalCharges?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0

    // 배팅 매출 (충전 - 배팅)
    const { data: bettingCharges } = await supabase
      .from("points")
      .select("amount")
      .eq("type", "charge")
      .eq("category", "betting")
      .eq("status", "approved")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())

    const bettingRevenue = bettingCharges?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0

    // 배팅 당첨 지급액 (task_items에서 won 상태인 항목들의 실제 당첨금 계산)
    const { data: bettingWins } = await supabase
      .from("task_items")
      .select("amount, details")
      .eq("category", "game")
      .eq("status", "won")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())

    let bettingPayout = 0
    if (bettingWins) {
      bettingPayout = bettingWins.reduce((sum, item) => {
        try {
          let details: any = {}
          if (item.details && typeof item.details === "string") {
            details = JSON.parse(item.details)
          } else if (typeof item.details === "object") {
            details = item.details
          }

          const betAmount = item.amount || 0
          const odds = details.odds || 1.0
          // 당첨금 = 배팅금액 * 배당률
          return sum + betAmount * odds
        } catch (e) {
          // details 파싱 실패 시 배팅금액만 사용
          return sum + (item.amount || 0)
        }
      }, 0)
    }

    // 순수익 = 일반 매출 + 배팅 매출 - 배팅 당첨 지급액
    const netProfit = generalRevenue + bettingRevenue - bettingPayout

    return NextResponse.json({
      success: true,
      summary: {
        date,
        generalRevenue,
        bettingRevenue,
        bettingPayout,
        netProfit,
      },
    })
  } catch (error: any) {
    console.error("Daily summary API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
