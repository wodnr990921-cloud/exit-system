import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
    }

    const { itemIds } = await request.json()

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: "아이템 ID가 필요합니다." }, { status: 400 })
    }

    // 오늘 날짜로 리셋 (필요시)
    await supabase.rpc("reset_daily_sender_usage").catch(() => {
      // 함수가 없으면 무시 (선택사항이므로)
    })

    // 오늘 사용 횟수가 가장 적은 발송인 찾기
    const { data: senders, error: sendersError } = await supabase
      .from("senders")
      .select("*")
      .order("daily_usage_count", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)

    if (sendersError || !senders || senders.length === 0) {
      return NextResponse.json({ error: "발송인을 찾을 수 없습니다." }, { status: 404 })
    }

    const selectedSender = senders[0]

    // 발송인 사용 횟수 증가
    const { error: updateError } = await supabase
      .from("senders")
      .update({ daily_usage_count: (selectedSender.daily_usage_count || 0) + 1 })
      .eq("id", selectedSender.id)

    if (updateError) {
      console.error("Error updating sender usage:", updateError)
    }

    // task_items 조회 (고객 정보 포함)
    const { data: items, error: itemsError } = await supabase
      .from("task_items")
      .select(
        `
        *,
        task:tasks!task_items_task_id_fkey (
          ticket_no,
          member_id,
          customer:customers!tasks_member_id_fkey (
            member_number,
            name,
            institution,
            prison_number,
            address
          )
        )
      `
      )
      .in("id", itemIds)

    if (itemsError) {
      return NextResponse.json({ error: "아이템 조회에 실패했습니다." }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "아이템을 찾을 수 없습니다." }, { status: 404 })
    }

    // 재고 확인 및 차감 (book 카테고리만)
    // 1단계: 모든 재고 확인 (차감 전)
    const stockChecks: Array<{ bookId: string; quantity: number; currentStock: number; bookTitle?: string }> = []
    
    for (const item of items) {
      if (item.category === "book" && item.details) {
        try {
          let details: any = {}
          if (typeof item.details === "string") {
            details = JSON.parse(item.details)
          } else if (typeof item.details === "object") {
            details = item.details
          }

          const bookId = details.book_id
          const quantity = details.quantity || 1

          if (bookId) {
            // books 테이블 조회
            const { data: book, error: bookError } = await supabase
              .from("books")
              .select("id, title, stock_quantity")
              .eq("id", bookId)
              .single()

            if (bookError || !book) {
              console.error("Error fetching book:", bookError)
              return NextResponse.json({ error: `도서 정보를 찾을 수 없습니다: ${bookId}` }, { status: 404 })
            }

            const currentStock = book.stock_quantity || 0

            // 재고 확인
            if (quantity > currentStock) {
              return NextResponse.json(
                { error: `재고 부족: "${book.title || bookId}" 요청 수량(${quantity}권) > 현재 재고(${currentStock}권)` },
                { status: 400 }
              )
            }

            stockChecks.push({ bookId, quantity, currentStock, bookTitle: book.title || bookId })
          }
        } catch (e) {
          console.error("Error processing book details:", e)
          // details 파싱 실패 시 경고만 하고 계속 진행 (기존 동작 유지)
        }
      }
    }

    // 2단계: 모든 재고 확인 통과 후 차감 (원자적 처리)
    for (const check of stockChecks) {
      const { error: updateStockError } = await supabase
        .from("books")
        .update({ stock_quantity: check.currentStock - check.quantity })
        .eq("id", check.bookId)

      if (updateStockError) {
        console.error("Error updating stock:", updateStockError)
        // 이미 차감한 재고는 롤백하지 않음 (실제 운영에서는 트랜잭션 필요)
        return NextResponse.json(
          { error: `재고 차감 실패: ${check.bookId}. 일부 재고가 이미 차감되었을 수 있습니다.` },
          { status: 500 }
        )
      }
    }

    // task_items 상태를 'shipped'로 업데이트
    const { error: updateItemsError } = await supabase
      .from("task_items")
      .update({ status: "shipped" })
      .in("id", itemIds)

    if (updateItemsError) {
      console.error("Error updating items status:", updateItemsError)
      return NextResponse.json({ error: "상태 업데이트에 실패했습니다." }, { status: 500 })
    }

    // 발송 기록 저장 (선택사항)
    const shipmentLogs = items.map((item: any) => ({
      task_item_id: item.id,
      sender_id: selectedSender.id,
      shipped_at: new Date().toISOString(),
    }))

    await supabase.from("shipment_logs").insert(shipmentLogs).catch((error) => {
      console.error("Error creating shipment logs:", error)
      // 로그 저장 실패해도 계속 진행
    })

    // 라벨 정보 반환
    const labelData = {
      sender: selectedSender,
      items: items.map((item: any) => ({
        id: item.id,
        description: item.description,
        category: item.category,
        amount: item.amount,
      })),
      customer: items[0]?.task?.customer,
      ticket_no: items[0]?.task?.ticket_no,
    }

    return NextResponse.json({
      success: true,
      label: labelData,
      message: "라벨이 생성되었습니다.",
    })
  } catch (error: any) {
    console.error("Generate Label Error:", error)
    return NextResponse.json(
      { error: "라벨 생성 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
