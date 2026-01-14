import { NextRequest, NextResponse } from "next/server"
import { HandwritingResponse } from "@/lib/ocr-types"

/**
 * 손글씨 인식 API
 * GPT-4o Vision API를 사용하여 손글씨를 텍스트로 변환합니다.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const formData = await request.formData()
    const imageFile = formData.get("image") as File
    const language = (formData.get("language") as string) || "ko"

    if (!imageFile) {
      return NextResponse.json(
        { success: false, error: "이미지 파일이 필요합니다." },
        { status: 400 }
      )
    }

    // 파일 크기 검증 (10MB)
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "파일 크기는 10MB를 초과할 수 없습니다." },
        { status: 400 }
      )
    }

    // 파일 형식 검증
    const supportedFormats = ["image/jpeg", "image/jpg", "image/png", "image/heic"]
    if (!supportedFormats.includes(imageFile.type.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: "지원하지 않는 파일 형식입니다. (JPG, PNG, HEIC만 지원)" },
        { status: 400 }
      )
    }

    // OpenAI API Key 확인
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json(
        { success: false, error: "OpenAI API Key가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    // 이미지를 Base64로 변환
    const arrayBuffer = await imageFile.arrayBuffer()
    const base64Image = Buffer.from(arrayBuffer).toString("base64")
    const mimeType = imageFile.type || "image/jpeg"

    // GPT-4o Vision API로 손글씨 인식
    const prompt = language === "ko"
      ? `이 이미지에 있는 손글씨를 정확하게 읽어서 텍스트로 변환해주세요.

중요 지침:
1. 한글 손글씨를 최대한 정확하게 인식하세요
2. 띄어쓰기와 문단을 원본과 동일하게 유지하세요
3. 읽기 어려운 부분은 [불명확]으로 표시하세요
4. 숫자, 특수문자, 날짜 등도 정확히 인식하세요
5. 추가 설명 없이 변환된 텍스트만 반환하세요

응답 형식 (JSON):
{
  "text": "변환된 텍스트",
  "confidence": 0-100 사이의 신뢰도 점수,
  "readability": 0-100 사이의 가독성 점수 (손글씨 깨끗함 정도),
  "language": "감지된 언어"
}`
      : `Please accurately read and convert the handwriting in this image to text.

Important instructions:
1. Recognize handwriting as accurately as possible
2. Maintain spacing and paragraphs identical to the original
3. Mark unclear parts as [unclear]
4. Accurately recognize numbers, special characters, dates, etc.
5. Return only the converted text without additional explanation

Response format (JSON):
{
  "text": "converted text",
  "confidence": confidence score between 0-100,
  "readability": readability score between 0-100 (how clear the handwriting is),
  "language": "detected language"
}`

    const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    })

    if (!visionResponse.ok) {
      let errorData: any = {}
      try {
        errorData = await visionResponse.json()
      } catch (e) {
        errorData = { message: await visionResponse.text().catch(() => "Unknown error") }
      }

      console.error("OpenAI API Error:", errorData)

      const errorMessage =
        errorData.error?.message ||
        errorData.message ||
        "손글씨 인식에 실패했습니다."

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: errorData,
        },
        { status: visionResponse.status }
      )
    }

    const data = await visionResponse.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { success: false, error: "손글씨 인식 결과를 받지 못했습니다." },
        { status: 500 }
      )
    }

    // JSON 파싱
    let jsonString = content.trim()
    if (jsonString.startsWith("```")) {
      jsonString = jsonString.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    let result
    try {
      result = JSON.parse(jsonString)
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Content:", jsonString)
      // JSON 파싱 실패 시 원문을 그대로 사용
      result = {
        text: content,
        confidence: 50,
        readability: 50,
        language: language,
      }
    }

    const processingTime = Date.now() - startTime

    // Public URL 생성 (필요한 경우)
    const originalImageUrl = `data:${mimeType};base64,${base64Image.substring(0, 100)}...`

    const response: HandwritingResponse = {
      success: true,
      data: {
        originalImage: originalImageUrl,
        convertedText: result.text || content,
        readabilityScore: result.readability || 0,
        confidence: result.confidence || 0,
        detectedLanguage: result.language || language,
        processingTime,
      },
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error("Handwriting OCR Error:", error)

    return NextResponse.json(
      {
        success: false,
        error: "손글씨 인식 중 오류가 발생했습니다.",
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET: 손글씨 인식 API 정보 반환
 */
export async function GET() {
  return NextResponse.json({
    name: "Handwriting OCR API",
    version: "1.0.0",
    description: "GPT-4o Vision을 사용한 손글씨 인식 API",
    supportedFormats: ["JPG", "PNG", "HEIC"],
    maxFileSize: "10MB",
    languages: ["ko", "en"],
    features: [
      "한글 손글씨 인식",
      "영어 손글씨 인식",
      "가독성 점수 계산",
      "신뢰도 점수 제공",
    ],
  })
}
