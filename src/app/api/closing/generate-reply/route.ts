import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { taskId } = await request.json()

    if (!taskId) {
      return NextResponse.json({ error: "taskId가 필요합니다." }, { status: 400 })
    }

    // 티켓 및 아이템 정보 조회
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(
        `
        id,
        member_id,
        total_amount,
        customer:customers!tasks_member_id_fkey (
          id,
          name,
          total_point_general,
          total_point_betting
        ),
        task_items (
          id,
          category,
          description,
          amount,
          status
        )
      `
      )
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: "티켓을 찾을 수 없습니다." }, { status: 404 })
    }

    const customer = task.customer
    if (!customer) {
      return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 })
    }

    // task_items 처리 내역 정리
    const items = task.task_items || []
    const categoryNames: Record<string, string> = {
      book: "도서",
      game: "경기",
      goods: "물품",
      inquiry: "문의",
      complaint: "민원",
      other: "기타",
      complex: "복합",
    }

    const processedItems = items
      .filter((item: any) => item.status === "approved" || item.status === "shipped" || item.status === "won")
      .map((item: any) => ({
        category: categoryNames[item.category] || item.category,
        description: item.description,
        amount: item.amount,
        status: item.status,
      }))

    // OpenAI API Key 확인
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API Key가 설정되지 않았습니다." }, { status: 500 })
    }

    // 고객 잔액 정보
    const generalBalance = customer.total_point_general || 0
    const bettingBalance = customer.total_point_betting || 0
    const totalBalance = generalBalance + bettingBalance

    // 프롬프트 생성
    const itemsText = processedItems
      .map((item: any) => `${item.category}: ${item.description} (${item.amount.toLocaleString()}원)`)
      .join("\n")

    const prompt = `당신은 교도소 수용자에게 보내는 답장 편지를 작성하는 전문가입니다.
다음 정보를 바탕으로 따뜻하고 친절한 서신체로 답장을 작성해주세요.

[회원 정보]
- 이름: ${customer.name}님

[처리 내역]
${itemsText || "처리된 내역이 없습니다."}

[금액 정보]
- 이번 거래 금액: ${task.total_amount?.toLocaleString() || 0}원
- 현재 잔액 (일반): ${generalBalance.toLocaleString()}원
- 현재 잔액 (배팅): ${bettingBalance.toLocaleString()}원

[작성 지침]
1. 존댓말과 정중한 톤을 사용하세요
2. 처리된 항목을 구체적이고 명확하게 안내하세요
3. 잔액 정보를 자연스럽게 포함하세요
4. 격려와 응원의 메시지를 포함하세요
5. 6-10문장 정도의 적절한 길이로 작성하세요
6. "안녕하세요"나 "감사합니다" 같은 인사말은 제외하고 본문만 작성하세요 (인사말은 시스템에서 자동으로 추가됩니다)

답장 본문:`

    // OpenAI API 호출
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("OpenAI API Error:", errorData)
      return NextResponse.json(
        { error: "답장 생성에 실패했습니다.", details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    const replyContent = data.choices[0]?.message?.content?.trim()

    if (!replyContent) {
      return NextResponse.json({ error: "답장 내용을 받지 못했습니다." }, { status: 500 })
    }

    return NextResponse.json({ success: true, replyContent })
  } catch (error: any) {
    console.error("Generate Reply Error:", error)
    return NextResponse.json(
      { error: "답장 생성 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}