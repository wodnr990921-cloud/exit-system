import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

/**
 * GET /api/document-retention
 * 파기 예정 문서 조회 (scheduled_destruction_date <= 오늘)
 * 권한: operator 이상
 */
export async function GET(request: NextRequest) {
  try {
    const { hasAccess } = await checkOperatorOrCEOAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "pending"

    const today = new Date().toISOString().split("T")[0]

    let query = supabase
      .from("document_retention")
      .select(
        `
        *,
        destroyed_by_user:users!destroyed_by (
          id,
          username
        )
      `
      )
      .order("document_date", { ascending: true })

    if (status === "pending") {
      query = query
        .eq("status", "pending_destruction")
        .lte("destruction_date", today)
    } else if (status === "destroyed") {
      query = query.eq("status", "destroyed")
    } else if (status === "all") {
      // 모든 문서 조회
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching document retention:", error)
      return NextResponse.json(
        { error: "문서 보관 내역을 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    // 통계
    const totalPending = data.filter((d: any) => d.destruction_status === "pending").length
    const totalDestroyed = data.filter((d: any) => d.destruction_status === "destroyed").length
    const dueSoon = data.filter(
      (d: any) =>
        d.destruction_status === "pending" && d.scheduled_destruction_date <= today
    ).length

    return NextResponse.json({
      success: true,
      documents: data,
      stats: {
        totalPending,
        totalDestroyed,
        dueSoon,
        today,
      },
    })
  } catch (error: any) {
    console.error("Document retention API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/document-retention
 * 파기 완료 처리
 * 권한: operator 이상
 */
export async function POST(request: NextRequest) {
  try {
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { documentIds, destructionNotes } = await request.json()

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: "파기할 문서 ID가 필요합니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 문서 파기 처리
    const { data: updated, error: updateError } = await supabase
      .from("document_retention")
      .update({
        destruction_status: "destroyed",
        destroyed_by: user.id,
        destroyed_at: new Date().toISOString(),
        destruction_notes: destructionNotes || "",
      })
      .in("id", documentIds)
      .eq("destruction_status", "pending")
      .select()

    if (updateError) {
      console.error("Error destroying documents:", updateError)
      return NextResponse.json(
        { error: "문서 파기 처리에 실패했습니다." },
        { status: 500 }
      )
    }

    // 감사 로그
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "destroy_documents",
      table_name: "document_retention",
      record_id: documentIds.join(","),
      changes: {
        destroyed_count: updated.length,
        document_ids: documentIds,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: `${updated.length}건의 문서가 파기 처리되었습니다.`,
      destroyed: updated,
    })
  } catch (error: any) {
    console.error("Document destruction API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
