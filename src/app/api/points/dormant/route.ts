import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

/**
 * GET /api/points/dormant
 * 휴면 계정 목록 조회
 * 권한: operator 이상
 */
export async function GET(request: NextRequest) {
  try {
    const { hasAccess } = await checkOperatorOrCEOAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const dormantMonths = parseInt(searchParams.get("months") || "12")

    // 휴면 기준 날짜 계산 (예: 12개월 이상 활동 없음)
    const dormantDate = new Date()
    dormantDate.setMonth(dormantDate.getMonth() - dormantMonths)

    // 휴면 계정 조회: 마지막 활동일이 기준일보다 이전이고, 잔액이 있는 고객
    const { data, error } = await supabase
      .from("customers")
      .select(
        `
        id,
        member_number,
        name,
        email,
        phone,
        balance,
        last_activity_at,
        is_dormant,
        dormant_since,
        created_at
      `
      )
      .lte("last_activity_at", dormantDate.toISOString())
      .gt("balance", 0)
      .order("last_activity_at", { ascending: true })

    if (error) {
      console.error("Error fetching dormant accounts:", error)
      return NextResponse.json(
        { error: "휴면 계정 목록을 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    // 통계
    const totalDormant = data.length
    const totalBalance = data.reduce((sum: number, customer: any) => sum + customer.balance, 0)
    const averageBalance = totalDormant > 0 ? totalBalance / totalDormant : 0

    return NextResponse.json({
      success: true,
      dormantAccounts: data,
      stats: {
        totalDormant,
        totalBalance,
        averageBalance,
        dormantMonths,
        dormantDate: dormantDate.toISOString(),
      },
    })
  } catch (error: any) {
    console.error("Dormant accounts API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/points/dormant
 * 휴면 포인트 회수 (confiscate_dormant_points RPC 호출)
 * 권한: operator 이상
 */
export async function POST(request: NextRequest) {
  try {
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { customerIds, reason, dormantMonths } = await request.json()

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json(
        { error: "회수할 고객 ID가 필요합니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 각 고객에 대해 RPC 함수 호출
    const results = []
    const errors = []

    for (const customerId of customerIds) {
      // RPC 함수 호출
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "confiscate_dormant_points",
        {
          customer_id: customerId,
          confiscation_reason: reason || "휴면 계정 포인트 회수",
          admin_id: user.id,
          dormant_period_months: dormantMonths || 12,
        }
      )

      if (rpcError) {
        console.error(`RPC error for customer ${customerId}:`, rpcError)
        errors.push({
          customerId,
          error: rpcError.message,
        })
      } else {
        results.push({
          customerId,
          result: rpcResult,
        })

        // 감사 로그
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          action: "confiscate_dormant_points",
          table_name: "customers",
          record_id: customerId,
          changes: {
            customerId,
            reason: reason || "휴면 계정 포인트 회수",
            result: rpcResult,
          },
          ip_address:
            request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        })
      }
    }

    // 결과 반환
    const successCount = results.filter((r) => r.result?.success).length
    const failCount = errors.length

    return NextResponse.json({
      success: successCount > 0,
      message: `${successCount}건 회수 성공, ${failCount}건 실패`,
      results,
      errors,
      stats: {
        totalProcessed: customerIds.length,
        successCount,
        failCount,
      },
    })
  } catch (error: any) {
    console.error("Confiscate dormant points API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
