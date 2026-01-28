import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { taskId, replyContent } = await request.json()

    if (!taskId) {
      return NextResponse.json({ error: "taskId가 필요합니다." }, { status: 400 })
    }

    // 티켓 정보 조회
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, status, member_id, customer_id, ticket_no")
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: "티켓을 찾을 수 없습니다." }, { status: 404 })
    }

    // 마감 가능 상태 확인 (completed 또는 processed 상태만 마감 가능)
    if (task.status !== "completed" && task.status !== "processed") {
      return NextResponse.json(
        { error: `마감할 수 없는 상태입니다. (현재 상태: ${task.status})` },
        { status: 400 }
      )
    }

    const customerId = task.customer_id || task.member_id
    const ticketNo = task.ticket_no

    // 마감 처리 (트랜잭션)
    const now = new Date().toISOString()

    // 1. tasks 테이블 업데이트: status -> 'closed', closed_at, closed_by, reply_content 설정
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        status: "closed",
        closed_at: now,
        closed_by: user.id,
        reply_content: replyContent || null,
        updated_at: now,
      })
      .eq("id", taskId)

    if (updateError) {
      console.error("Error updating task:", updateError)
      return NextResponse.json(
        { error: "마감 처리에 실패했습니다.", details: updateError.message },
        { status: 500 }
      )
    }

    // 2. 포인트 승인 및 실제 차감
    if (customerId && ticketNo) {
      // 이 티켓과 관련된 pending 상태의 포인트 찾기
      const { data: pendingPoints, error: pointsError } = await supabase
        .from("points")
        .select("*")
        .eq("customer_id", customerId)
        .eq("status", "pending")
        .eq("type", "use")
        .ilike("reason", `%${ticketNo}%`) // reason에 ticket_no가 포함된 경우

      if (pointsError) {
        console.error("Error fetching pending points:", pointsError)
      }

      if (pendingPoints && pendingPoints.length > 0) {
        // 포인트별로 승인 처리
        for (const point of pendingPoints) {
          // 1. 포인트 상태를 approved로 변경
          const { error: approveError } = await supabase
            .from("points")
            .update({
              status: "approved",
              approved_by: user.id,
            })
            .eq("id", point.id)

          if (approveError) {
            console.error("Error approving point:", approveError)
            continue
          }

          // 2. 회원의 실제 포인트 차감
          const { data: customer, error: customerError } = await supabase
            .from("customers")
            .select("total_point_general, total_point_betting")
            .eq("id", customerId)
            .single()

          if (customerError || !customer) {
            console.error("Error fetching customer:", customerError)
            continue
          }

          let newGeneral = customer.total_point_general || 0
          let newBetting = customer.total_point_betting || 0

          // amount 절댓값을 사용하여 무조건 차감
          const amountToDeduct = Math.abs(point.amount)

          if (point.category === "general") {
            newGeneral -= amountToDeduct // 차감
            if (newGeneral < 0) {
              console.error("Insufficient general points:", {
                current: customer.total_point_general,
                toDeduct: amountToDeduct
              })
              // 롤백: 포인트 상태를 다시 pending으로
              await supabase
                .from("points")
                .update({ status: "pending", approved_by: null })
                .eq("id", point.id)
              continue
            }
          } else if (point.category === "betting") {
            newBetting -= amountToDeduct // 차감
            if (newBetting < 0) {
              console.error("Insufficient betting points:", {
                current: customer.total_point_betting,
                toDeduct: amountToDeduct
              })
              // 롤백: 포인트 상태를 다시 pending으로
              await supabase
                .from("points")
                .update({ status: "pending", approved_by: null })
                .eq("id", point.id)
              continue
            }
          }

          // 포인트 업데이트
          const { error: updateError } = await supabase
            .from("customers")
            .update({
              total_point_general: newGeneral,
              total_point_betting: newBetting,
            })
            .eq("id", customerId)

          if (updateError) {
            console.error("Error updating customer points:", updateError)
            // 롤백: 포인트 상태를 다시 pending으로
            await supabase
              .from("points")
              .update({ status: "pending", approved_by: null })
              .eq("id", point.id)
          }
        }
      }
    }

    // 3. 도서 재고 및 배팅 정산 내역은 이미 처리되었으므로 추가 작업 불필요
    // (재고 차감은 이미 라벨 생성 시 처리되었고, 배팅 정산은 스포츠 관리에서 처리됨)

    return NextResponse.json({
      success: true,
      message: "마감 처리가 완료되었습니다.",
      closedAt: now,
    })
  } catch (error: any) {
    console.error("Approve Closing Error:", error)
    return NextResponse.json(
      { error: "마감 처리 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}