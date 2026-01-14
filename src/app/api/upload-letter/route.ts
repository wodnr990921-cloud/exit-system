import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import Tesseract from "tesseract.js"

// Node.js 런타임 사용 (Tesseract.js가 Node.js 환경 필요)
export const runtime = "nodejs"

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

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // 파일 크기 제한 (10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      )
    }

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Supabase Storage에 파일 업로드
    const fileExt = file.name.split(".").pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`
    const filePath = `letters/${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("letters")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("Upload error:", uploadError)
      return NextResponse.json(
        { error: "Failed to upload file", details: uploadError.message },
        { status: 500 }
      )
    }

    // Public URL 가져오기
    const {
      data: { publicUrl },
    } = supabase.storage.from("letters").getPublicUrl(filePath)

    // OCR 처리
    const { data: ocrData } = await Tesseract.recognize(
      buffer,
      "kor+eng", // 한국어와 영어 지원
      {
        logger: (m) => console.log(m), // 진행 상황 로깅
      }
    )

    const ocrText = ocrData.text

    // 데이터베이스에 편지 정보 저장
    const { data: letterData, error: dbError } = await supabase
      .from("letters")
      .insert({
        user_id: user.id,
        file_path: filePath,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        ocr_text: ocrText,
        status: "processed",
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database error:", dbError)
      // 업로드는 성공했으므로 OCR 결과만 반환
      return NextResponse.json({
        success: true,
        fileUrl: publicUrl,
        filePath,
        ocrText,
        message: "File uploaded and OCR processed, but failed to save to database",
      })
    }

    return NextResponse.json({
      success: true,
      letter: letterData,
      fileUrl: publicUrl,
      filePath,
      ocrText,
      message: "File uploaded and OCR processed successfully",
    })
  } catch (error: any) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
