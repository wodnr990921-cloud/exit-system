import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hasMinimumRole } from "@/lib/permissions"

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 사용자 권한 확인 (operator 이상만 가능)
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!userData || !hasMinimumRole(userData.role, "operator")) {
      return NextResponse.json(
        { error: "티켓 상태 변경 권한이 없습니다. (operator 이상 필요)" },
        { status: 403 }
      )
    }

    const { task_id, status } = await request.json()

    // 필수 필드 확인
    if (!task_id || !status) {
      return NextResponse.json(
        { error: "task_id와 status는 필수입니다." },
        { status: 400 }
      )
    }

    // 허용된 상태 값 확인
    const allowedStatuses = ["received", "processing", "processed", "closed", "cancelled"]
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `허용되지 않은 상태입니다. (${allowedStatuses.join(", ")})` },
        { status: 400 }
      )
    }

    // 티켓 조회
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, status, ticket_no, closed_at, closed_by")
      .eq("id", task_id)
      .single()

    if (taskError || !task) {
      return NextResponse.json(
        { error: "티켓을 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    // 상태 업데이트 데이터 준비
    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString(),
    }

    // closed 상태로 변경 시
    if (status === "closed" && task.status !== "closed") {
      updateData.closed_at = new Date().toISOString()
      updateData.closed_by = user.id
    }

    // closed 상태에서 다른 상태로 변경 시 (재오픈)
    if (status !== "closed" && task.status === "closed") {
      updateData.closed_at = null
      updateData.closed_by = null
    }

    // 티켓 상태 업데이트
    const { data: updatedTask, error: updateError } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", task_id)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating task status:", updateError)
      return NextResponse.json(
        { error: "티켓 상태 업데이트에 실패했습니다.", details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
      message: `티켓 상태가 ${status}로 변경되었습니다.`,
    })
  } catch (error: any) {
    console.error("Ticket status update error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
