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

    const { taskItemId, reason, restoreStock } = await request.json()

    if (!taskItemId) {
      return NextResponse.json({ error: "아이템 ID가 필요합니다." }, { status: 400 })
    }

    // task_item 조회
    const { data: taskItem, error: itemError } = await supabase
      .from("task_items")
      .select(
        `
        id,
        amount,
        category,
        description,
        status,
        task_id,
        details,
        tasks!task_items_task_id_fkey (
          member_id
        )
      `
      )
      .eq("id", taskItemId)
      .single()

    if (itemError || !taskItem) {
      return NextResponse.json({ error: "아이템을 찾을 수 없습니다." }, { status: 404 })
    }

    if (taskItem.status === "refunded") {
      return NextResponse.json({ error: "이미 환불된 아이템입니다." }, { status: 400 })
    }

    const customerId = taskItem.tasks?.member_id
    if (!customerId) {
      return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 })
    }

    // customer 잔액 조회
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("total_point_general, total_point_betting")
      .eq("id", customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: "회원 정보를 불러올 수 없습니다." }, { status: 500 })
    }

    // 환불 금액 결정 (category에 따라)
    const refundAmount = taskItem.amount || 0
    const isBetting = taskItem.category === "game" || taskItem.category === "betting"
    const pointCategory = isBetting ? "betting" : "general"

    // points 테이블에 환불 기록
    const { data: refundPoint, error: pointError } = await supabase
      .from("points")
      .insert({
        customer_id: customerId,
        amount: refundAmount,
        category: pointCategory,
        type: "refund",
        status: "approved",
        reason: reason || `부분 환불: ${taskItem.description}`,
        task_item_id: taskItemId,
        requested_by: user.id,
        approved_by: user.id,
      })
      .select()
      .single()

    if (pointError) {
      console.error("Error creating refund point:", pointError)
      return NextResponse.json({ error: "환불 기록 생성에 실패했습니다." }, { status: 500 })
    }

    // customer 잔액 업데이트
    const currentBalance = isBetting ? customer.total_point_betting : customer.total_point_general
    const newBalance = currentBalance + refundAmount

    const updateField = isBetting ? "total_point_betting" : "total_point_general"
    const { error: updateError } = await supabase
      .from("customers")
      .update({ [updateField]: newBalance })
      .eq("id", customerId)

    if (updateError) {
      console.error("Error updating customer balance:", updateError)
      return NextResponse.json({ error: "회원 잔액 업데이트에 실패했습니다." }, { status: 500 })
    }

    // 도서 환불 시 재고 복구 (restoreStock이 true인 경우)
    if (taskItem.category === "book" && restoreStock && taskItem.details) {
      try {
        let details: any = {}
        if (typeof taskItem.details === "string") {
          details = JSON.parse(taskItem.details)
        } else if (typeof taskItem.details === "object") {
          details = taskItem.details
        }

        const bookId = details.book_id
        const quantity = details.quantity || 1

        if (bookId) {
          // 현재 재고 조회
          const { data: book, error: bookError } = await supabase
            .from("books")
            .select("stock_quantity")
            .eq("id", bookId)
            .single()

          if (!bookError && book) {
            const currentStock = book.stock_quantity || 0
            // 재고 증가
            await supabase
              .from("books")
              .update({ stock_quantity: currentStock + quantity })
              .eq("id", bookId)
          }
        }
      } catch (e) {
        console.error("Error restoring stock:", e)
        // 재고 복구 실패해도 환불은 성공으로 처리
      }
    }

    // task_item 상태를 'refunded'로 변경
    const { error: itemUpdateError } = await supabase
      .from("task_items")
      .update({ status: "refunded" })
      .eq("id", taskItemId)

    if (itemUpdateError) {
      console.error("Error updating task item status:", itemUpdateError)
      // 환불은 성공했지만 상태 업데이트 실패 - 경고만 하고 성공으로 처리
    }

    return NextResponse.json({
      success: true,
      refund: {
        amount: refundAmount,
        category: pointCategory,
        taskItemId,
        stockRestored: taskItem.category === "book" && restoreStock,
      },
    })
  } catch (error: any) {
    console.error("Refund API error:", error)
    return NextResponse.json(
      { error: "환불 처리 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
