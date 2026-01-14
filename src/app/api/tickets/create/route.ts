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

    const { member_id, items } = await request.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "최소 1개 이상의 아이템이 필요합니다." }, { status: 400 })
    }

    // 총액 계산
    const total_amount = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)

    // 티켓번호 생성 (YYYYMMDD-XXXXXX 형식)
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
    const ticket_no = `T${dateStr}-${randomStr}`

    // OpenAI로 요약 생성
    let ai_summary = ""
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY
      if (openaiApiKey) {
        // 비용 절감: 필요한 필드만 포함 (category, description, amount)
        const itemsText = items
          .map((item: any) => {
            const categoryNames: Record<string, string> = {
              book: "도서",
              game: "경기",
              goods: "물품",
              inquiry: "문의",
              complaint: "민원",
              other: "기타",
              complex: "복합",
            }
            // 최소한의 정보만 포함
            return JSON.stringify({
              category: categoryNames[item.category] || item.category,
              description: item.description || "",
              amount: item.amount || 0,
            })
          })
          .join("\n")

        const summaryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
                content: `다음 티켓 아이템들을 간결하게 요약해주세요 (예: "도서 1권, 경기 1건 (총 35,000P)" 형식):

${itemsText}

요약 (총 개수와 금액 포함):`,
              },
            ],
            max_tokens: 150,
            temperature: 0.7,
          }),
        })

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json()
          ai_summary = summaryData.choices[0]?.message?.content?.trim() || ""
        }
      }
    } catch (error) {
      console.error("Error generating summary:", error)
      // 요약 실패해도 티켓은 생성
    }

    // 트랜잭션으로 tasks와 task_items 저장
    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .insert([
        {
          user_id: user.id,
          ticket_no: ticket_no,
          member_id: member_id || null,
          customer_id: member_id || null, // 호환성 유지
          total_amount: total_amount,
          ai_summary: ai_summary || null,
          status: "draft",
          title: `티켓 ${ticket_no}`,
          description: ai_summary || "",
        },
      ])
      .select()
      .single()

    if (taskError) {
      console.error("Error creating task:", taskError)
      return NextResponse.json({ error: "티켓 생성에 실패했습니다.", details: taskError.message }, { status: 500 })
    }

    // task_items 생성
    const taskItems = items.map((item: any) => ({
      task_id: taskData.id,
      category: item.category,
      description: item.description,
      amount: item.amount || 0,
      status: "pending",
    }))

    const { error: itemsError } = await supabase.from("task_items").insert(taskItems)

    if (itemsError) {
      console.error("Error creating task items:", itemsError)
      // 롤백: task 삭제
      await supabase.from("tasks").delete().eq("id", taskData.id)
      return NextResponse.json({ error: "아이템 저장에 실패했습니다.", details: itemsError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      ticket_no: ticket_no,
      task_id: taskData.id,
      message: "티켓이 성공적으로 생성되었습니다.",
    })
  } catch (error: any) {
    console.error("Create Ticket Error:", error)
    return NextResponse.json(
      { error: "티켓 생성 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
