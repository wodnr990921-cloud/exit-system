import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { text } = await request.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "분류할 텍스트가 필요합니다." }, { status: 400 })
    }

    // OpenAI API Key 확인
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API Key가 설정되지 않았습니다." }, { status: 500 })
    }

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
            content: `다음 티켓 내용을 다음 카테고리 중 하나로 분류해주세요:
- 이체
- 도서
- 단순문의
- 민원
- 배팅
- 물품대행
- 기타
- 복합

티켓 내용:
${text}

위 카테고리 중 하나만 선택하여 응답해주세요. 다른 설명 없이 카테고리 이름만 출력해주세요.`,
          },
        ],
        max_tokens: 50,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("OpenAI API Error:", errorData)
      return NextResponse.json(
        { error: "카테고리 분류에 실패했습니다.", details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    const category = data.choices[0]?.message?.content?.trim()

    if (!category) {
      return NextResponse.json({ error: "카테고리 분류 결과를 받지 못했습니다." }, { status: 500 })
    }

    // 응답이 카테고리 목록에 있는지 확인
    const validCategories = ["이체", "도서", "단순문의", "민원", "배팅", "물품대행", "기타", "복합"]
    const matchedCategory = validCategories.find((cat) => category.includes(cat))

    return NextResponse.json({ success: true, category: matchedCategory || "기타" })
  } catch (error: any) {
    console.error("Categorize Error:", error)
    return NextResponse.json(
      { error: "카테고리 분류 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
