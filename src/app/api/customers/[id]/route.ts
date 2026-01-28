import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkCEOAccess } from "@/lib/.cursorrules/permissions"

/**
 * DELETE /api/customers/[id]
 * 회원 삭제 (CEO 전용)
 *
 * 연관 데이터도 함께 삭제:
 * - tasks (티켓)
 * - task_items (티켓 아이템)
 * - task_comments (티켓 댓글)
 * - points (포인트 내역)
 * - customer_flags (플래그)
 * - 기타 외래키 참조 테이블
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { hasAccess, user, role } = await checkCEOAccess()

    if (!hasAccess || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "권한이 없습니다. CEO만 회원을 삭제할 수 있습니다.",
          currentRole: role
        },
        { status: 403 }
      )
    }

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { success: false, error: "회원 ID가 필요합니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 1. 회원 정보 조회 (감사 로그용)
    const { data: customer, error: fetchError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError || !customer) {
      return NextResponse.json(
        { success: false, error: "회원을 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    // 2. 연관 데이터 개수 조회 (사용자에게 알려주기 위함)
    const { count: tasksCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", id)

    const { count: pointsCount } = await supabase
      .from("points")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", id)

    // 3. 연관 데이터 삭제 (순서 중요: 외래키 제약)

    // 3-1. task_comments 삭제 (tasks의 자식)
    const { data: taskIds } = await supabase
      .from("tasks")
      .select("id")
      .eq("customer_id", id)

    if (taskIds && taskIds.length > 0) {
      const taskIdList = taskIds.map(t => t.id)

      await supabase
        .from("task_comments")
        .delete()
        .in("task_id", taskIdList)
    }

    // 3-2. task_items 삭제 (tasks의 자식)
    if (taskIds && taskIds.length > 0) {
      const taskIdList = taskIds.map(t => t.id)

      await supabase
        .from("task_items")
        .delete()
        .in("task_id", taskIdList)
    }

    // 3-3. tasks 삭제
    await supabase
      .from("tasks")
      .delete()
      .eq("customer_id", id)

    // 3-4. points 삭제
    await supabase
      .from("points")
      .delete()
      .eq("customer_id", id)

    // 3-5. customer_flags 삭제
    await supabase
      .from("customer_flags")
      .delete()
      .eq("customer_id", id)

    // 4. 회원 삭제
    const { error: deleteError } = await supabase
      .from("customers")
      .delete()
      .eq("id", id)

    if (deleteError) {
      console.error("Customer deletion error:", deleteError)
      return NextResponse.json(
        {
          success: false,
          error: "회원 삭제에 실패했습니다.",
          details: deleteError.message
        },
        { status: 500 }
      )
    }

    // 5. 감사 로그 기록
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "DELETE",
      table_name: "customers",
      record_id: id,
      old_values: {
        ...customer,
        deleted_related_tasks: tasksCount || 0,
        deleted_related_points: pointsCount || 0
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    })

    return NextResponse.json({
      success: true,
      message: "회원이 삭제되었습니다.",
      deletedData: {
        customer: {
          id: customer.id,
          member_number: customer.member_number,
          name: customer.name
        },
        relatedTasks: tasksCount || 0,
        relatedPoints: pointsCount || 0
      }
    })
  } catch (error: any) {
    console.error("Customer deletion API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다.",
        details: error.message
      },
      { status: 500 }
    )
  }
}
