import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

/**
 * POST /api/document-retention/destroy
 * 파기 완료 처리
 * 권한: operator 이상
 */
export async function POST(request: NextRequest) {
  try {
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { documentId, destructionMethod, notes } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: "문서 ID가 필요합니다." }, { status: 400 })
    }

    const supabase = await createClient()

    // 문서 정보 조회
    const { data: document, error: fetchError } = await supabase
      .from("document_retention")
      .select(
        `
        *,
        customer:customers!document_retention_customer_id_fkey (
          id,
          name,
          member_number
        )
      `
      )
      .eq("id", documentId)
      .single()

    if (fetchError || !document) {
      return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 })
    }

    // 이미 파기된 문서인지 확인
    if (document.destruction_status === "destroyed") {
      return NextResponse.json(
        { error: "이미 파기 처리된 문서입니다." },
        { status: 400 }
      )
    }

    // 파기 처리
    const { data: updated, error: updateError } = await supabase
      .from("document_retention")
      .update({
        destruction_status: "destroyed",
        destruction_date: new Date().toISOString(),
        destruction_method: destructionMethod || "shredding",
        destruction_notes: notes || "",
        destroyed_by: user.id,
      })
      .eq("id", documentId)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating document retention:", updateError)
      return NextResponse.json(
        { error: "파기 처리에 실패했습니다." },
        { status: 500 }
      )
    }

    // 관련 파일이 있으면 Supabase Storage에서 삭제
    if (document.file_path) {
      try {
        const { error: deleteError } = await supabase.storage
          .from("documents")
          .remove([document.file_path])

        if (deleteError) {
          console.error("Error deleting file from storage:", deleteError)
          // 파일 삭제 실패해도 계속 진행
        }
      } catch (storageError) {
        console.error("Storage deletion error:", storageError)
      }
    }

    // 감사 로그
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "destroy_document",
      table_name: "document_retention",
      record_id: documentId,
      changes: {
        document: document,
        destruction: updated,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "문서가 파기 처리되었습니다.",
      document: updated,
    })
  } catch (error: any) {
    console.error("Document destroy API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
