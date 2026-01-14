import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkAdminAccess } from "@/lib/.cursorrules/admin"

/**
 * GET /api/notices/popup
 * 활성화된 팝업 공지사항 조회
 *
 * 현재 사용자가 아직 보지 않았거나, "다시 보지 않기" 처리하지 않은
 * 활성 상태의 팝업 공지사항을 반환합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    // 활성화된 팝업 공지사항 조회
    const { data: notices, error } = await supabase
      .from("notices")
      .select("*")
      .eq("is_popup", true)
      .eq("is_active", true)
      .lte("start_date", new Date().toISOString())
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching popup notices:", error)
      return NextResponse.json(
        { error: "공지사항을 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    // 사용자가 "다시 보지 않기" 처리한 공지사항 필터링
    const { data: dismissedNotices } = await supabase
      .from("notice_dismissals")
      .select("notice_id")
      .eq("user_id", user.id)

    const dismissedIds = new Set(dismissedNotices?.map(d => d.notice_id) || [])

    const activeNotices = notices?.filter(notice => !dismissedIds.has(notice.id)) || []

    return NextResponse.json({
      success: true,
      notices: activeNotices,
      count: activeNotices.length,
    })
  } catch (error: any) {
    console.error("Popup notices API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notices/popup
 * 팝업 공지사항 생성
 *
 * Body:
 * - title: string (제목)
 * - content: string (내용)
 * - start_date: string (시작일)
 * - end_date?: string (종료일, 선택)
 * - priority?: number (우선순위, 기본값: 0)
 *
 * 권한: admin만
 */
export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const { isAdmin, userId } = await checkAdminAccess()
    if (!isAdmin || !userId) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, content, start_date, end_date, priority = 0 } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: "제목과 내용은 필수입니다." },
        { status: 400 }
      )
    }

    if (!start_date) {
      return NextResponse.json(
        { error: "시작일은 필수입니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 공지사항 생성
    const { data: notice, error } = await supabase
      .from("notices")
      .insert({
        title,
        content,
        is_popup: true,
        is_active: true,
        start_date: new Date(start_date).toISOString(),
        end_date: end_date ? new Date(end_date).toISOString() : null,
        priority: priority,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating notice:", error)
      return NextResponse.json(
        { error: "공지사항 생성에 실패했습니다." },
        { status: 500 }
      )
    }

    // 감사 로그 기록
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "create",
      table_name: "notices",
      record_id: notice.id,
      changes: {
        new: notice,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    })

    return NextResponse.json({
      success: true,
      message: "팝업 공지사항이 생성되었습니다.",
      notice,
    })
  } catch (error: any) {
    console.error("Create popup notice error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/notices/popup
 * "다시 보지 않기" 처리
 *
 * Body:
 * - noticeId: string (공지사항 ID)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { noticeId } = body

    if (!noticeId) {
      return NextResponse.json(
        { error: "공지사항 ID는 필수입니다." },
        { status: 400 }
      )
    }

    // 공지사항 존재 확인
    const { data: notice, error: noticeError } = await supabase
      .from("notices")
      .select("id, title")
      .eq("id", noticeId)
      .single()

    if (noticeError || !notice) {
      return NextResponse.json(
        { error: "공지사항을 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    // 이미 "다시 보지 않기" 처리했는지 확인
    const { data: existing } = await supabase
      .from("notice_dismissals")
      .select("id")
      .eq("user_id", user.id)
      .eq("notice_id", noticeId)
      .single()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "이미 처리된 공지사항입니다.",
      })
    }

    // "다시 보지 않기" 기록 생성
    const { error: insertError } = await supabase
      .from("notice_dismissals")
      .insert({
        user_id: user.id,
        notice_id: noticeId,
      })

    if (insertError) {
      console.error("Error creating notice dismissal:", insertError)
      return NextResponse.json(
        { error: "처리 중 오류가 발생했습니다." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "다시 보지 않기 처리되었습니다.",
    })
  } catch (error: any) {
    console.error("Dismiss notice error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
