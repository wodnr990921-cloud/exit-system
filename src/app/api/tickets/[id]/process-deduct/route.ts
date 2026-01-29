import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normalizePointAmount } from "@/lib/point-utils"

/**
 * 티켓 내에서 차감 처리 (도서/물품/대행)
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

    const { items } = await request.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "차감 항목이 필요합니다." }, { status: 400 })
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

    // 회원 잔액 확인
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("total_point_general, total_point_betting")
      .eq("id", customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 })
    }

    // 카테고리별로 포인트 분류 (game = betting, 나머지 = general)
    let generalAmount = 0
    let bettingAmount = 0

    items.forEach((item: any) => {
      const amount = item.amount || 0
      if (item.category === "game") {
        bettingAmount += amount
      } else {
        generalAmount += amount
      }
    })

    // 잔액 확인
    const availableGeneral = customer.total_point_general || 0
    const availableBetting = customer.total_point_betting || 0

    if (generalAmount > availableGeneral) {
      return NextResponse.json(
        { error: `일반 포인트 잔액이 부족합니다. (필요: ${generalAmount}P, 보유: ${availableGeneral}P)` },
        { status: 400 }
      )
    }

    if (bettingAmount > availableBetting) {
      return NextResponse.json(
        { error: `배팅 포인트 잔액이 부족합니다. (필요: ${bettingAmount}P, 보유: ${availableBetting}P)` },
        { status: 400 }
      )
    }

    // 포인트 차감 기록 생성 (pending 상태)
    const pointRecords = []

    if (generalAmount > 0) {
      pointRecords.push({
        customer_id: customerId,
        user_id: user.id,
        amount: normalizePointAmount(generalAmount, "use"), // 자동으로 음수 처리
        category: "general",
        type: "use",
        status: "pending",
        reason: `티켓 ${task.ticket_no} - 일반 포인트 차감 (${items.filter((i: any) => i.category !== "game").map((i: any) => i.description).join(", ")})`,
        requested_by: user.id,
      })
    }

    if (bettingAmount > 0) {
      pointRecords.push({
        customer_id: customerId,
        user_id: user.id,
        amount: normalizePointAmount(bettingAmount, "use"),
        category: "betting",
        type: "use",
        status: "pending",
        reason: `티켓 ${task.ticket_no} - 배팅 포인트 차감 (${items.filter((i: any) => i.category === "game").map((i: any) => i.description).join(", ")})`,
        requested_by: user.id,
      })
    }

    if (pointRecords.length > 0) {
      const { error: pointError } = await supabase.from("points").insert(pointRecords)

      if (pointError) {
        console.error("Point creation error:", pointError)
        return NextResponse.json({ error: "포인트 차감 기록 생성에 실패했습니다." }, { status: 500 })
      }
    }

    // task_items에 항목 추가
    const taskItems = items.map((item: any) => ({
      task_id: taskId,
      category: item.category,
      description: item.description,
      amount: item.amount || 0,
      status: "pending",
    }))

    const { error: itemsError } = await supabase.from("task_items").insert(taskItems)

    if (itemsError) {
      console.error("Task items error:", itemsError)
      return NextResponse.json({ error: "티켓 항목 추가에 실패했습니다." }, { status: 500 })
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
      message: `${items.length}개 항목이 추가되었습니다. (승인 대기)`,
    })
  } catch (error: any) {
    console.error("Process deduct API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
