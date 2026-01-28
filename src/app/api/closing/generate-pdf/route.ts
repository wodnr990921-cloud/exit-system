import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * 일일 마감 PDF 생성 API
 * 오늘 날짜의 모든 답변 내용을 포함한 PDF 데이터 반환
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 및 권한 확인 (Operator 이상)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!userData || !['ceo', 'admin', 'operator'].includes(userData.role)) {
      return NextResponse.json(
        { error: "권한이 없습니다. (Operator 이상 필요)" },
        { status: 403 }
      )
    }

    const { date } = await request.json()
    const targetDate = date || new Date().toISOString().split('T')[0]

    // 해당 날짜에 마감된 모든 티켓 조회 (reply_content가 있는 것)
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id,
        ticket_no,
        total_amount,
        reply_content,
        closed_at,
        closed_by,
        member_id,
        customers!tasks_member_id_fkey (
          name,
          member_number,
          institution
        ),
        task_items (
          category,
          description,
          amount
        )
      `)
      .gte("closed_at", `${targetDate}T00:00:00`)
      .lt("closed_at", `${targetDate}T23:59:59`)
      .not("reply_content", "is", null)
      .order("closed_at", { ascending: true })

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError)
      return NextResponse.json(
        { error: "티켓 조회 실패", details: tasksError.message },
        { status: 500 }
      )
    }

    // 답변이 작성된 티켓도 포함 (아직 마감 안 됐지만 오늘 작성된 답변)
    const { data: pendingWithReply, error: pendingError } = await supabase
      .from("tasks")
      .select(`
        id,
        ticket_no,
        total_amount,
        reply_content,
        updated_at,
        member_id,
        status,
        customers!tasks_member_id_fkey (
          name,
          member_number,
          institution
        ),
        task_items (
          category,
          description,
          amount
        )
      `)
      .gte("updated_at", `${targetDate}T00:00:00`)
      .lt("updated_at", `${targetDate}T23:59:59`)
      .not("reply_content", "is", null)
      .neq("status", "closed")
      .order("updated_at", { ascending: true })

    if (!pendingError && pendingWithReply) {
      tasks.push(...pendingWithReply)
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "오늘 날짜에 출력할 답변이 없습니다.",
        tasks: []
      })
    }

    // PDF 생성용 데이터 포맷팅
    const pdfData = tasks.map((task: any) => {
      const customer = Array.isArray(task.customers) ? task.customers[0] : task.customers

      return {
        ticketNo: task.ticket_no,
        customerName: customer?.name || "알 수 없음",
        memberNumber: customer?.member_number || "",
        institution: customer?.institution || "",
        items: task.task_items?.map((item: any) => ({
          category: getCategoryName(item.category),
          description: item.description,
          amount: item.amount
        })) || [],
        totalAmount: task.total_amount || 0,
        replyContent: task.reply_content || "",
        closedAt: task.closed_at || task.updated_at,
      }
    })

    return NextResponse.json({
      success: true,
      count: pdfData.length,
      date: targetDate,
      tasks: pdfData,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: user.id,
      }
    })

  } catch (error: any) {
    console.error("Generate PDF Data Error:", error)
    return NextResponse.json(
      { error: "PDF 데이터 생성 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

function getCategoryName(category: string): string {
  const categoryNames: Record<string, string> = {
    book: "도서",
    game: "경기/베팅",
    goods: "물품",
    inquiry: "문의",
    complaint: "민원",
    other: "기타",
    complex: "복합",
  }
  return categoryNames[category] || category
}
