import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess, checkReadAccess } from "@/lib/.cursorrules/permissions"

/**
 * GET /api/returns
 * 반송 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { hasAccess } = await checkReadAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const customerId = searchParams.get("customerId")

    let query = supabase
      .from("returns")
      .select(
        `
        *,
        customer:customers!returns_customer_id_fkey (
          id,
          member_number,
          name,
          phone
        ),
        original_logistics:logistics_items!returns_original_logistics_id_fkey (
          id,
          tracking_number,
          recipient_name,
          recipient_address
        ),
        handled_by_user:users!returns_handled_by_fkey (
          id,
          username
        )
      `
      )
      .order("created_at", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    if (customerId) {
      query = query.eq("customer_id", customerId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching returns:", error)
      return NextResponse.json(
        { error: "반송 목록을 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    // 통계
    const stats = {
      total: data.length,
      pending: data.filter((r: any) => r.status === "pending").length,
      reshipped: data.filter((r: any) => r.status === "reshipped").length,
      disposed: data.filter((r: any) => r.status === "disposed").length,
    }

    return NextResponse.json({
      success: true,
      returns: data,
      stats,
    })
  } catch (error: any) {
    console.error("Returns API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/returns
 * 반송 등록
 * 권한: operator 이상
 */
export async function POST(request: NextRequest) {
  try {
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { taskId, customerId, originalLogisticsId, returnReason, returnDate, notes, returnNotes } =
      await request.json()

    // taskId 또는 customerId 중 하나는 있어야 함
    if ((!taskId && !customerId) || !returnReason) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해주세요." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // taskId가 있으면 task 확인
    if (taskId) {
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("id, customer_id")
        .eq("id", taskId)
        .single()

      if (taskError || !task) {
        return NextResponse.json({ error: "티켓을 찾을 수 없습니다." }, { status: 404 })
      }

      // 반송 등록
      const { data: returnRecord, error: insertError } = await supabase
        .from("returns")
        .insert({
          task_id: taskId,
          return_reason: returnReason,
          return_date: returnDate || new Date().toISOString().split("T")[0],
          return_notes: returnNotes || notes || "",
          refund_status: "pending",
          created_by: user.id,
        })
        .select()
        .single()

      if (insertError) {
        console.error("Error creating return:", insertError)
        return NextResponse.json({ error: "반송 등록에 실패했습니다." }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "반송이 등록되었습니다.",
        return: returnRecord,
      })
    }

    // 기존 로직 (customerId 사용)
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, name")
      .eq("id", customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 })
    }

    // 반송 등록
    const { data: returnRecord, error: insertError } = await supabase
      .from("returns")
      .insert({
        task_id: null,
        return_reason: returnReason,
        return_date: returnDate || new Date().toISOString().split("T")[0],
        return_notes: returnNotes || notes || "",
        refund_status: "pending",
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating return:", insertError)
      return NextResponse.json({ error: "반송 등록에 실패했습니다." }, { status: 500 })
    }

    // 원본 물류 상태 업데이트
    if (originalLogisticsId) {
      await supabase
        .from("logistics_items")
        .update({
          status: "returned",
          return_id: returnRecord.id,
        })
        .eq("id", originalLogisticsId)
    }

    // 감사 로그
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_return",
      table_name: "returns",
      record_id: returnRecord.id,
      changes: { return: returnRecord },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "반송이 등록되었습니다.",
      return: returnRecord,
    })
  } catch (error: any) {
    console.error("Return create API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/returns
 * 반송 처리 (재발송/폐기)
 * 권한: operator 이상
 */
export async function PUT(request: NextRequest) {
  try {
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { returnId, action, newLogisticsId, disposalReason, notes } = await request.json()

    if (!returnId || !action) {
      return NextResponse.json(
        { error: "반송 ID와 처리 방법이 필요합니다." },
        { status: 400 }
      )
    }

    // action 검증
    if (!["reship", "dispose"].includes(action)) {
      return NextResponse.json(
        { error: "유효하지 않은 처리 방법입니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 반송 정보 조회
    const { data: returnRecord, error: fetchError } = await supabase
      .from("returns")
      .select("*")
      .eq("id", returnId)
      .single()

    if (fetchError || !returnRecord) {
      return NextResponse.json({ error: "반송 정보를 찾을 수 없습니다." }, { status: 404 })
    }

    // 이미 처리된 반송인지 확인
    if (returnRecord.status !== "pending") {
      return NextResponse.json(
        { error: "이미 처리된 반송입니다." },
        { status: 400 }
      )
    }

    let updateData: any = {
      handled_by: user.id,
      handled_at: new Date().toISOString(),
    }

    if (action === "reship") {
      // 재발송
      if (!newLogisticsId) {
        return NextResponse.json(
          { error: "재발송을 위한 새 물류 ID가 필요합니다." },
          { status: 400 }
        )
      }

      updateData.status = "reshipped"
      updateData.new_logistics_id = newLogisticsId
      updateData.resolution_notes = notes || "재발송 완료"
    } else if (action === "dispose") {
      // 폐기
      updateData.status = "disposed"
      updateData.disposal_reason = disposalReason || "고객 수령 불가"
      updateData.disposal_date = new Date().toISOString()
      updateData.resolution_notes = notes || "폐기 완료"
    }

    const { data: updated, error: updateError } = await supabase
      .from("returns")
      .update(updateData)
      .eq("id", returnId)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating return:", updateError)
      return NextResponse.json({ error: "반송 처리에 실패했습니다." }, { status: 500 })
    }

    // 감사 로그
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: `return_${action}`,
      table_name: "returns",
      record_id: returnId,
      changes: {
        old: returnRecord,
        new: updated,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: action === "reship" ? "재발송 처리되었습니다." : "폐기 처리되었습니다.",
      return: updated,
    })
  } catch (error: any) {
    console.error("Return update API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
