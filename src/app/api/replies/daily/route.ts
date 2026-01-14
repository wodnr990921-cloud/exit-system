import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * 일일 티켓 답변 취합 API
 * 그날 나가야 하는 답변을 모두 취합하여 반환
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0]

    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    // 그날 답변이 필요한 티켓 조회 (assigned, in_progress 상태의 티켓)
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(
        `
        id,
        ticket_no,
        member_id,
        description,
        customer:customers!tasks_member_id_fkey (
          id,
          name,
          institution,
          prison_number,
          mailbox_address
        ),
        task_comments!task_comments_task_id_fkey (
          id,
          comment,
          created_at
        )
      `
      )
      .eq("status", "assigned")
      .or("status.eq.in_progress,status.eq.completed")
      .order("created_at", { ascending: true })

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError)
      return NextResponse.json({ error: "티켓을 불러오는데 실패했습니다." }, { status: 500 })
    }

    // 활성화된 공지사항 조회 (한 번만)
    const { data: notices } = await supabase
      .from("notices")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })

    // 각 티켓에 대한 알림 메시지 및 댓글 조회
    const replies = await Promise.all(
      (tasks || []).map(async (task) => {
        if (!task.customer || !task.member_id) return null

        // 해당 회원의 당일 미전송 알림 메시지 조회
        const { data: notifications } = await supabase
          .from("customer_notifications")
          .select("*")
          .eq("customer_id", task.member_id)
          .eq("sent", false)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
          .order("created_at", { ascending: true })

        // 티켓 답신(고객용 답변) 조회
        const { data: customerReplies } = await supabase
          .from("task_comments")
          .select("comment, created_at")
          .eq("task_id", task.id)
          .eq("comment_type", "customer_reply")
          .order("created_at", { ascending: false })
          .limit(1)

        const ticketReply = customerReplies && customerReplies.length > 0 ? customerReplies[0].comment : ""

        // 답변이 있는 티켓만 반환
        if (!ticketReply.trim()) {
          return null
        }

        return {
          taskId: task.id,
          ticketNo: task.ticket_no,
          customer: task.customer,
          ticketReply,
          notifications: notifications || [],
          notices: notices || [],
        }
      })
    )

    const validReplies = replies.filter((r) => r !== null && r.ticketReply && r.ticketReply.trim())

    return NextResponse.json({
      success: true,
      date,
      replies: validReplies,
      count: validReplies.length,
    })
  } catch (error: any) {
    console.error("Daily replies API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
