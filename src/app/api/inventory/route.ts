import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess, checkReadAccess } from "@/lib/.cursorrules/permissions"

/**
 * GET /api/inventory
 * 재고 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 읽기 권한 확인
    const { hasAccess } = await checkReadAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const lowStock = searchParams.get("lowStock") === "true"

    let query = supabase
      .from("inventory_items")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true })

    if (category) {
      query = query.eq("category", category)
    }

    if (lowStock) {
      // 재고가 최소 수량 이하인 항목만 조회
      query = query.or("current_stock.lte.min_quantity")
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching inventory:", error)
      return NextResponse.json(
        { error: "재고 목록을 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    // 재고 통계 계산
    const totalItems = data.length
    const lowStockItems = data.filter(
      (item: any) => item.current_stock <= item.min_quantity
    ).length
    const outOfStockItems = data.filter((item: any) => item.current_stock === 0).length

    return NextResponse.json({
      success: true,
      inventory: data,
      stats: {
        totalItems,
        lowStockItems,
        outOfStockItems,
      },
    })
  } catch (error: any) {
    console.error("Inventory API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory
 * 재고 사용/입고 기록 (트랜잭션 생성)
 * 권한: operator 이상
 */
export async function POST(request: NextRequest) {
  try {
    // 권한 확인
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const {
      itemId,
      transactionType,
      quantity,
      reason,
      referenceId,
      referenceType,
    } = await request.json()

    if (!itemId || !transactionType || !quantity) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해주세요." },
        { status: 400 }
      )
    }

    // transactionType 검증
    const validTypes = ["use", "restock", "adjustment", "disposal"]
    if (!validTypes.includes(transactionType)) {
      return NextResponse.json(
        { error: "유효하지 않은 거래 유형입니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 재고 항목 조회
    const { data: item, error: itemError } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", itemId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: "재고 항목을 찾을 수 없습니다." }, { status: 404 })
    }

    // 사용인 경우 재고 부족 확인
    if (transactionType === "use" || transactionType === "disposal") {
      if (item.current_stock < quantity) {
        return NextResponse.json(
          { error: "재고가 부족합니다." },
          { status: 400 }
        )
      }
    }

    // 트랜잭션 생성
    const { data: transaction, error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        inventory_item_id: itemId,
        transaction_type: transactionType,
        quantity: quantity,
        previous_quantity: item.current_stock,
        reason: reason || "",
        reference_id: referenceId || null,
        reference_type: referenceType || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (transactionError) {
      console.error("Error creating inventory transaction:", transactionError)
      return NextResponse.json(
        { error: "재고 거래 생성에 실패했습니다." },
        { status: 500 }
      )
    }

    // 재고 수량 업데이트
    let newQuantity = item.current_stock
    if (transactionType === "use" || transactionType === "disposal") {
      newQuantity = item.current_stock - quantity
    } else if (transactionType === "restock" || transactionType === "adjustment") {
      newQuantity = item.current_stock + quantity
    }

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({
        current_stock: newQuantity,
        last_updated: new Date().toISOString(),
      })
      .eq("id", itemId)

    if (updateError) {
      console.error("Error updating inventory:", updateError)
      // 트랜잭션 롤백
      await supabase.from("inventory_transactions").delete().eq("id", transaction.id)
      return NextResponse.json(
        { error: "재고 업데이트에 실패했습니다." },
        { status: 500 }
      )
    }

    // 감사 로그
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: `inventory_${transactionType}`,
      table_name: "inventory_transactions",
      record_id: transaction.id,
      changes: {
        item: item.name,
        transaction: transaction,
        previousQuantity: item.current_stock,
        newQuantity: newQuantity,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "재고가 업데이트되었습니다.",
      transaction: transaction,
      item: {
        id: item.id,
        name: item.name,
        previousQuantity: item.current_stock,
        newQuantity: newQuantity,
        unit: item.unit,
      },
    })
  } catch (error: any) {
    console.error("Inventory transaction API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inventory
 * 새 재고 항목 추가
 * 권한: operator 이상
 */
export async function PUT(request: NextRequest) {
  try {
    // 권한 확인
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { name, category, currentQuantity, minQuantity, unit, description } =
      await request.json()

    if (!name || !category || currentQuantity === undefined) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해주세요." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        name,
        category,
        current_stock: currentQuantity,
        min_quantity: minQuantity || 10,
        unit: unit || "개",
        description: description || "",
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating inventory item:", error)
      return NextResponse.json(
        { error: "재고 항목 생성에 실패했습니다." },
        { status: 500 }
      )
    }

    // 감사 로그
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_inventory",
      table_name: "inventory",
      record_id: data.id,
      changes: { new: data },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "재고 항목이 생성되었습니다.",
      item: data,
    })
  } catch (error: any) {
    console.error("Inventory create API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
