import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { detectProhibitedContent, formatDetectionSummary } from "@/lib/content-filter"
import {
  OcrResponse,
  ImageType,
  ConfidenceLevel,
  EnvelopeInfo,
  LetterContentInfo,
  ProductInfo,
  RemittanceInfo,
} from "@/lib/ocr-types"

/**
 * 향상된 OCR API
 * - 이미지 타입 자동 감지 (편지봉투, 편지 내용, 물품 사진, 송금 증빙)
 * - 자동 회원 매칭
 * - 금지어 탐지
 * - 손글씨 인식
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const formData = await request.formData()
    const imageFile = formData.get("image") as File
    const detectImageType = formData.get("detectImageType") === "true"
    const detectProhibited = formData.get("detectProhibited") === "true"
    const extractHandwriting = formData.get("extractHandwriting") === "true"

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

    // 1단계: 이미지 타입 감지
    const imageType = detectImageType
      ? await detectImageTypeFromImage(base64Image, mimeType, openaiApiKey)
      : ImageType.UNKNOWN

    // 2단계: 이미지 타입별 OCR 수행
    const ocrResult = await performOcrByType(
      base64Image,
      mimeType,
      imageType,
      openaiApiKey
    )

    // 3단계: 금지어 탐지
    let prohibitedContent = undefined
    if (detectProhibited && ocrResult.rawText) {
      const detection = detectProhibitedContent(ocrResult.rawText)
      if (detection.found) {
        prohibitedContent = {
          found: true,
          score: detection.score,
          matches: detection.matches,
          summary: formatDetectionSummary(detection),
        }
      }
    }

    // 4단계: 손글씨 인식 (필요한 경우)
    let handwritingData = undefined
    if (extractHandwriting && imageType === ImageType.LETTER_CONTENT) {
      handwritingData = await extractHandwritingText(
        base64Image,
        mimeType,
        openaiApiKey
      )
    }

    // 5단계: 고객 매칭 (편지봉투인 경우)
    let customerMatch = undefined
    if (imageType === ImageType.ENVELOPE && ocrResult.structuredData) {
      const envelopeInfo = ocrResult.structuredData as EnvelopeInfo
      customerMatch = await matchCustomer(envelopeInfo.senderName || "")
    }

    const processingTime = Date.now() - startTime

    // 응답 생성
    const response: OcrResponse = {
      success: true,
      data: {
        imageType,
        confidence: ocrResult.confidence,
        confidenceLevel: getConfidenceLevel(ocrResult.confidence),
        rawText: ocrResult.rawText,
        structuredData: ocrResult.structuredData,
        prohibitedContent,
        handwriting: handwritingData,
        customerMatch,
        processingTime,
      },
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error("OCR Error:", error)
    console.error("Error stack:", error.stack)
    
    // 더 자세한 오류 정보 제공
    const errorMessage = error.message || "알 수 없는 오류"
    const errorDetails = {
      message: errorMessage,
      type: error.name,
      code: error.code,
    }
    
    return NextResponse.json(
      {
        success: false,
        error: "OCR 처리 중 오류가 발생했습니다.",
        details: errorMessage,
        debug: errorDetails,
      },
      { status: 500 }
    )
  }
}

/**
 * 이미지 타입 감지
 */
async function detectImageTypeFromImage(
  base64Image: string,
  mimeType: string,
  apiKey: string
): Promise<ImageType> {
  const prompt = `이 이미지의 타입을 분류해주세요.

타입 정의:
1. envelope: 편지봉투 (발신인 정보, 주소가 있음)
2. letter_content: 편지 내용 (본문 텍스트, 손글씨)
3. product_photo: 물품 사진 (상품, 제품)
4. remittance_proof: 송금 증빙 (계좌이체 확인증, 입금 영수증)
5. unknown: 알 수 없음

JSON 형식으로만 응답:
{"imageType": "타입", "confidence": 0-100}`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
            ],
          },
        ],
        max_tokens: 100,
        temperature: 0.3,
      }),
    })

    if (!response.ok) return ImageType.UNKNOWN

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) return ImageType.UNKNOWN

    let jsonString = content.trim()
    if (jsonString.startsWith("```")) {
      jsonString = jsonString.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    const result = JSON.parse(jsonString)
    return (result.imageType as ImageType) || ImageType.UNKNOWN
  } catch (error) {
    console.error("Image type detection error:", error)
    return ImageType.UNKNOWN
  }
}

/**
 * 이미지 타입별 OCR 수행
 */
async function performOcrByType(
  base64Image: string,
  mimeType: string,
  imageType: ImageType,
  apiKey: string
): Promise<{
  rawText: string
  confidence: number
  structuredData: any
}> {
  let prompt = ""

  switch (imageType) {
    case ImageType.ENVELOPE:
      prompt = `편지봉투의 모든 텍스트를 읽어주세요.
발신인 정보, 수신인 정보, 주소, 우편번호 등을 추출해주세요.

JSON 형식으로 응답:
{
  "senderName": "발신인 이름",
  "senderAddress": "발신인 주소",
  "recipientName": "수신인 이름",
  "recipientAddress": "수신인 주소",
  "postalCode": "우편번호",
  "confidence": 0-100,
  "rawText": "봉투의 모든 텍스트 (빠짐없이)"
}

중요: rawText에 봉투에 있는 모든 글자를 포함시켜주세요.`
      break

    case ImageType.LETTER_CONTENT:
      prompt = `이 이미지의 모든 텍스트를 정확하게 읽어주세요.
인쇄된 글자와 손글씨를 모두 인식해주세요.
가능한 한 원본 그대로 줄바꿈과 문단을 유지해주세요.

JSON 형식으로 응답:
{
  "fullText": "전체 텍스트 (모든 내용)",
  "paragraphs": ["문단1", "문단2", ...],
  "handwritten": true/false,
  "confidence": 0-100,
  "rawText": "전체 텍스트 (동일)"
}

중요: rawText에 이미지의 모든 글자를 빠짐없이 포함시켜주세요.`
      break

    case ImageType.PRODUCT_PHOTO:
      prompt = `물품 사진에서 정보를 추출해주세요:

JSON 형식으로 응답:
{
  "productName": "상품명",
  "description": "설명",
  "quantity": 수량,
  "price": 가격,
  "confidence": 0-100,
  "rawText": "모든 텍스트"
}`
      break

    case ImageType.REMITTANCE_PROOF:
      prompt = `송금 증빙에서 정보를 추출해주세요:

JSON 형식으로 응답:
{
  "amount": 금액,
  "accountNumber": "계좌번호",
  "bankName": "은행명",
  "senderName": "보내는 사람",
  "recipientName": "받는 사람",
  "transactionDate": "거래일시",
  "confidence": 0-100,
  "rawText": "모든 텍스트"
}`
      break

    default:
      prompt = `이 이미지의 모든 텍스트를 정확하게 읽어주세요.
인쇄된 글자, 손글씨, 타이핑, 모든 형태의 텍스트를 인식해주세요.
한글, 영어, 숫자 모두 포함시켜주세요.

JSON 형식으로 응답:
{
  "rawText": "모든 텍스트 (빠짐없이)",
  "confidence": 0-100
}

중요: 이미지에 있는 모든 글자를 빠짐없이 추출해주세요.`
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("OpenAI API 오류:", response.status, errorData)
      throw new Error(`OCR API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("OCR 결과를 받지 못했습니다.")
    }

    let jsonString = content.trim()
    if (jsonString.startsWith("```")) {
      jsonString = jsonString.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    const result = JSON.parse(jsonString)

    // rawText가 비어있으면 content 전체를 사용
    const extractedText = result.rawText || result.fullText || content
    
    console.log("OCR 추출 완료:", {
      textLength: extractedText.length,
      confidence: result.confidence,
      imageType: imageType
    })

    return {
      rawText: extractedText,
      confidence: result.confidence || 50,
      structuredData: result,
    }
  } catch (error: any) {
    console.error("OCR by type error:", error)
    console.error("Error details:", error.message, error.stack)
    
    // 오류 발생 시에도 기본 텍스트 추출 시도
    return {
      rawText: `OCR 처리 중 오류 발생: ${error.message}`,
      confidence: 0,
      structuredData: null,
    }
  }
}

/**
 * 손글씨 추출
 */
async function extractHandwritingText(
  base64Image: string,
  mimeType: string,
  apiKey: string
) {
  const prompt = `이 손글씨를 텍스트로 변환하고 가독성을 평가해주세요:

JSON 형식으로 응답:
{
  "convertedText": "변환된 텍스트",
  "readabilityScore": 0-100,
  "confidence": 0-100
}`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    })

    if (!response.ok) return undefined

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) return undefined

    let jsonString = content.trim()
    if (jsonString.startsWith("```")) {
      jsonString = jsonString.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    const result = JSON.parse(jsonString)

    return {
      detected: true,
      convertedText: result.convertedText || "",
      readabilityScore: result.readabilityScore || 0,
    }
  } catch (error) {
    console.error("Handwriting extraction error:", error)
    return undefined
  }
}

/**
 * 고객 매칭
 */
async function matchCustomer(senderName: string) {
  if (!senderName || senderName.trim() === "") {
    return { found: false, matchScore: 0 }
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("customers")
      .select("id, name, member_number")
      .ilike("name", `%${senderName}%`)
      .limit(5)

    if (error || !data || data.length === 0) {
      return { found: false, matchScore: 0 }
    }

    // 정확도 계산
    const matches = data.map((customer) => {
      const similarity = calculateStringSimilarity(senderName, customer.name)
      return {
        customerId: customer.id,
        customerName: customer.name,
        memberNumber: customer.member_number,
        matchScore: Math.round(similarity * 100),
      }
    })

    // 가장 높은 매칭 점수 반환
    const bestMatch = matches.reduce((prev, current) =>
      prev.matchScore > current.matchScore ? prev : current
    )

    return {
      found: true,
      ...bestMatch,
    }
  } catch (error) {
    console.error("Customer matching error:", error)
    return { found: false, matchScore: 0 }
  }
}

/**
 * 문자열 유사도 계산 (Levenshtein Distance)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  const distance = matrix[len1][len2]
  const maxLen = Math.max(len1, len2)
  return 1 - distance / maxLen
}

/**
 * 신뢰도 레벨 계산
 */
function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 90) return ConfidenceLevel.HIGH
  if (confidence >= 70) return ConfidenceLevel.MEDIUM
  return ConfidenceLevel.LOW
}
