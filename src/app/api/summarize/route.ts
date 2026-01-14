import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "요약할 텍스트가 필요합니다." }, { status: 400 })
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
            content: `다음 티켓 내용을 간결하게 요약해주세요 (2-3문장 이내):

${text}

요약:`,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("OpenAI API Error:", errorData)
      return NextResponse.json(
        { error: "요약 처리에 실패했습니다.", details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    const summary = data.choices[0]?.message?.content?.trim()

    if (!summary) {
      return NextResponse.json({ error: "요약 결과를 받지 못했습니다." }, { status: 500 })
    }

    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    console.error("Summarize Error:", error)
    return NextResponse.json(
      { error: "요약 처리 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
