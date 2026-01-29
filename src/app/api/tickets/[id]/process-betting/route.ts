import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hasMinimumRole } from "@/lib/permissions"
import { normalizePointAmount } from "@/lib/point-utils"

/**
 * 티켓 내에서 배팅 처리
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 사용자 권한 확인
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { match_id, betting_choice, betting_amount, betting_odds } = await request.json()

    if (!match_id || !betting_choice || !betting_amount || betting_amount <= 0) {
      return NextResponse.json({ error: "필수 정보가 누락되었습니다." }, { status: 400 })
    }

    // 배당은 관리자급만 설정 가능
    if (betting_odds !== null && betting_odds !== undefined) {
      if (!hasMinimumRole(userData.role, "operator")) {
        return NextResponse.json(
          { error: "배당 설정은 관리자급 이상만 가능합니다." },
          { status: 403 }
        )
      }
    }

    // 티켓 정보 조회
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, customer_id, member_id, ticket_no, status")
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: "티켓을 찾을 수 없습니다." }, { status: 404 })
    }

    const customerId = task.customer_id || task.member_id

    if (!customerId) {
      return NextResponse.json({ error: "회원 정보가 없습니다." }, { status: 400 })
    }

    // 회원 배팅 포인트 확인
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("total_point_betting")
      .eq("id", customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 })
    }

    const availableBetting = customer.total_point_betting || 0

    if (betting_amount > availableBetting) {
      return NextResponse.json(
        { error: `배팅 포인트 잔액이 부족합니다. (필요: ${betting_amount}P, 보유: ${availableBetting}P)` },
        { status: 400 }
      )
    }

    // 예상 당첨금 계산 (배당이 있는 경우)
    const potential_win = betting_odds ? Math.floor(betting_amount * betting_odds) : null

    // task_items에 배팅 항목 추가
    const { data: taskItem, error: taskItemError } = await supabase
      .from("task_items")
      .insert({
        task_id: taskId,
        match_id,
        betting_choice,
        betting_odds: betting_odds || null, // 접수 시 null 가능
        potential_win,
        category: "game",
        description: `${betting_choice} 배팅`,
        amount: betting_amount,
        status: "pending",
      })
      .select()
      .single()

    if (taskItemError) {
      console.error("Task item error:", taskItemError)
      return NextResponse.json({ error: "배팅 항목 추가에 실패했습니다." }, { status: 500 })
    }

    // 배팅 포인트 차감 기록 (pending 상태)
    const { error: pointError } = await supabase.from("points").insert({
      customer_id: customerId,
      user_id: user.id,
      amount: normalizePointAmount(betting_amount, "use"), // 자동으로 음수
      category: "betting",
      type: "use",
      status: "pending",
      reason: `티켓 ${task.ticket_no} - 배팅 (${betting_choice})`,
      requested_by: user.id,
    })

    if (pointError) {
      console.error("Point error:", pointError)
      // 롤백: task_item 삭제
      await supabase.from("task_items").delete().eq("id", taskItem.id)
      return NextResponse.json({ error: "포인트 차감 기록 생성에 실패했습니다." }, { status: 500 })
    }

    // 티켓 상태 업데이트
    if (task.status === "assigned" || task.status === "received") {
      await supabase
        .from("tasks")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", taskId)
    }

    return NextResponse.json({
      success: true,
      message: betting_odds
        ? `배팅이 추가되었습니다. (예상 당첨금: ${potential_win?.toLocaleString()}P)`
        : "배팅이 추가되었습니다. (배당 미설정)",
      data: {
        task_item_id: taskItem.id,
        potential_win,
      },
    })
  } catch (error: any) {
    console.error("Process betting API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
