import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normalizePointAmount } from "@/lib/point-utils"

/**
 * 티켓 내에서 충전/입금 처리
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

    const { amount, category, type, reason } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "금액이 필요합니다." }, { status: 400 })
    }

    if (!category || !["general", "betting"].includes(category)) {
      return NextResponse.json({ error: "카테고리가 필요합니다." }, { status: 400 })
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

    // 포인트 거래 생성 (charge/deposit 타입은 양수)
    const pointAmount = normalizePointAmount(amount, type || "charge")

    const { error: pointError } = await supabase.from("points").insert({
      customer_id: customerId,
      user_id: user.id,
      amount: pointAmount,
      category,
      type: type || "charge",
      status: "pending", // 승인 대기
      reason: reason || `티켓 ${task.ticket_no} - ${category === "general" ? "일반" : "배팅"} 포인트 충전`,
      requested_by: user.id,
    })

    if (pointError) {
      console.error("Point creation error:", pointError)
      return NextResponse.json({ error: "포인트 거래 생성에 실패했습니다." }, { status: 500 })
    }

    // 티켓 상태 업데이트 (processing으로)
    if (task.status === "assigned" || task.status === "received") {
      await supabase
        .from("tasks")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", taskId)
    }

    return NextResponse.json({
      success: true,
      message: `${category === "general" ? "일반" : "배팅"} 포인트 충전이 요청되었습니다. (승인 대기)`,
    })
  } catch (error: any) {
    console.error("Process charge API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
