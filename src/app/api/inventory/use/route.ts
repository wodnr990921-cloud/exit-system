import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

/**
 * POST /api/inventory/use
 * 재고 사용 기록
 * 권한: operator 이상
 */
export async function POST(request: NextRequest) {
  try {
    // 권한 확인
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { inventoryId, quantity, reason, customerId } = await request.json()

    if (!inventoryId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: "재고 ID와 사용 수량이 필요합니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 현재 재고 확인
    const { data: inventory, error: fetchError } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", inventoryId)
      .single()

    if (fetchError || !inventory) {
      return NextResponse.json({ error: "재고를 찾을 수 없습니다." }, { status: 404 })
    }

    // 재고 부족 확인
    if (inventory.current_stock < quantity) {
      return NextResponse.json(
        {
          error: "재고가 부족합니다.",
          available: inventory.current_stock,
          requested: quantity,
        },
        { status: 400 }
      )
    }

    // 재고 차감
    const newQuantity = inventory.current_stock - quantity
    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({
        current_stock: newQuantity,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", inventoryId)

    if (updateError) {
      console.error("Error updating inventory:", updateError)
      return NextResponse.json({ error: "재고 업데이트에 실패했습니다." }, { status: 500 })
    }

    // 사용 기록 생성
    const { data: record, error: recordError } = await supabase
      .from("inventory_transactions")
      .insert({
        inventory_id: inventoryId,
        transaction_type: "use",
        quantity: quantity,
        reason: reason || "사용",
        customer_id: customerId || null,
        user_id: user.id,
        previous_quantity: inventory.current_stock,
        new_quantity: newQuantity,
      })
      .select()
      .single()

    if (recordError) {
      console.error("Error creating inventory transaction:", recordError)
    }

    // 재고 부족 알림 확인
    let lowStockAlert = false
    if (newQuantity <= inventory.min_quantity) {
      lowStockAlert = true
    }

    return NextResponse.json({
      success: true,
      message: "재고가 사용 처리되었습니다.",
      inventory: {
        id: inventory.id,
        name: inventory.name,
        previousQuantity: inventory.current_stock,
        newQuantity,
        lowStockAlert,
      },
      transaction: record,
    })
  } catch (error: any) {
    console.error("Inventory use API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
