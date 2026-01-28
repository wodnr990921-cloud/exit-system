import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/procurement
 * 발주/물품대행 현황 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const category = searchParams.get("category")

    let query = supabase
      .from("task_items")
      .select(`
        id,
        task_id,
        category,
        description,
        amount,
        status,
        procurement_status,
        cost_price,
        selling_price,
        shipping_cost,
        sender_name,
        created_at,
        updated_at,
        details,
        task:tasks!task_items_task_id_fkey(
          id,
          ticket_no,
          customer_id,
          status,
          customer:customers!tasks_customer_id_fkey(name, member_number)
        )
      `)
      .in("category", ["book", "goods"])
      .order("created_at", { ascending: false })

    if (status) {
      query = query.eq("procurement_status", status)
    }

    if (category) {
      query = query.eq("category", category)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      items: data || [],
      count: data?.length || 0,
    })
  } catch (error: any) {
    console.error("Procurement GET error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/procurement
 * 발주 상태 업데이트
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 권한 확인
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!userData || !["operator", "admin", "ceo"].includes(userData.role)) {
      return NextResponse.json(
        { error: "권한이 없습니다. operator 이상만 가능합니다." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      itemId,
      procurement_status,
      cost_price,
      selling_price,
      shipping_cost,
      sender_name,
      tracking_number,
    } = body

    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 })
    }

    // task_item 조회
    const { data: item, error: fetchError } = await supabase
      .from("task_items")
      .select("*, task:tasks!task_items_task_id_fkey(customer_id)")
      .eq("id", itemId)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    // 업데이트 데이터 준비
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (procurement_status) {
      updateData.procurement_status = procurement_status
    }

    if (cost_price !== undefined) {
      updateData.cost_price = cost_price
    }

    if (selling_price !== undefined) {
      updateData.selling_price = selling_price
    }

    if (shipping_cost !== undefined) {
      updateData.shipping_cost = shipping_cost
    }

    if (sender_name) {
      updateData.sender_name = sender_name
    }

    // details JSON 업데이트
    let details = item.details || {}
    if (typeof details === "string") {
      details = JSON.parse(details)
    }

    if (tracking_number) {
      details.tracking_number = tracking_number
    }

    details.last_updated_by = user.id
    details.last_updated_at = new Date().toISOString()

    updateData.details = details

    // 업데이트 실행
    const { data: updatedItem, error: updateError } = await supabase
      .from("task_items")
      .update(updateData)
      .eq("id", itemId)
      .select()
      .single()

    if (updateError) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update item" },
        { status: 500 }
      )
    }

    // 발주 완료 시 알림 발송 (선택사항)
    if (procurement_status === "completed") {
      try {
        // 회원에게 알림
        const taskData = Array.isArray(item.task) ? item.task[0] : item.task
        if (taskData?.customer_id) {
          // 여기에 알림 로직 추가 가능
          console.log(`[PROCUREMENT] 발주 완료 알림: ${itemId}`)
        }
      } catch (notifyError) {
        console.error("Notification error:", notifyError)
        // 알림 실패는 무시
      }
    }

    return NextResponse.json({
      success: true,
      message: "발주 정보가 업데이트되었습니다",
      item: updatedItem,
    })
  } catch (error: any) {
    console.error("Procurement PUT error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/procurement
 * 발주 일괄 처리
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 권한 확인
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!userData || !["operator", "admin", "ceo"].includes(userData.role)) {
      return NextResponse.json(
        { error: "권한이 없습니다. operator 이상만 가능합니다." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { itemIds, procurement_status, sender_name } = body

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: "itemIds array is required" },
        { status: 400 }
      )
    }

    if (!procurement_status) {
      return NextResponse.json(
        { error: "procurement_status is required" },
        { status: 400 }
      )
    }

    let successCount = 0
    let failCount = 0
    const results = []

    for (const itemId of itemIds) {
      try {
        const updateData: any = {
          procurement_status,
          updated_at: new Date().toISOString(),
        }

        if (sender_name) {
          updateData.sender_name = sender_name
        }

        const { error } = await supabase
          .from("task_items")
          .update(updateData)
          .eq("id", itemId)

        if (error) {
          failCount++
          results.push({ itemId, success: false, error: error.message })
        } else {
          successCount++
          results.push({ itemId, success: true })
        }
      } catch (error: any) {
        failCount++
        results.push({ itemId, success: false, error: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${successCount}개 항목 업데이트 완료 (실패: ${failCount}개)`,
      successCount,
      failCount,
      results,
    })
  } catch (error: any) {
    console.error("Procurement POST error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
