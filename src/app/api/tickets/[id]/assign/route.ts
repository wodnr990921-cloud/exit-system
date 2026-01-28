import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hasMinimumRole } from "@/lib/permissions"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // 관리자급(operator) 이상만 담당자 배정 가능
    if (!hasMinimumRole(userData.role, "operator")) {
      return NextResponse.json(
        { error: "담당자 배정 권한이 없습니다. (관리자급 이상 필요)" },
        { status: 403 }
      )
    }

    const { assignee_id } = await request.json()

    if (!assignee_id) {
      return NextResponse.json({ error: "담당자 ID가 필요합니다." }, { status: 400 })
    }

    // 담당자 존재 여부 확인
    const { data: assigneeData } = await supabase
      .from("users")
      .select("id, name, username")
      .eq("id", assignee_id)
      .single()

    if (!assigneeData) {
      return NextResponse.json({ error: "존재하지 않는 담당자입니다." }, { status: 404 })
    }

    // 티켓 상태 확인
    const { data: ticket } = await supabase
      .from("tasks")
      .select("id, status")
      .eq("id", id)
      .single()

    if (!ticket) {
      return NextResponse.json({ error: "티켓을 찾을 수 없습니다." }, { status: 404 })
    }

    // 티켓 업데이트: 담당자 배정 및 상태 변경
    const updates: any = {
      assigned_to: assignee_id,
      updated_at: new Date().toISOString(),
    }

    // received 상태면 assigned로 변경
    if (ticket.status === "received" || ticket.status === "pending" || ticket.status === "draft") {
      updates.status = "assigned"
    }

    const { error: updateError } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)

    if (updateError) {
      console.error("Assign error:", updateError)
      return NextResponse.json({ error: "담당자 배정에 실패했습니다." }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${assigneeData.name || assigneeData.username}에게 배정되었습니다.`,
    })
  } catch (error: any) {
    console.error("Assign API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
