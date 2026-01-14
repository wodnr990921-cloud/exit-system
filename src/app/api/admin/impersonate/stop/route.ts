import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

/**
 * POST /api/admin/impersonate/stop
 * Impersonation 종료 및 원래 계정으로 복귀
 *
 * 쿠키에 저장된 원래 사용자 정보를 사용하여 원래 계정으로 돌아갑니다.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const originalUserId = cookieStore.get("original_user_id")?.value

    if (!originalUserId) {
      return NextResponse.json(
        { error: "Impersonate 상태가 아닙니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 원래 사용자 정보 조회
    const { data: originalUser, error: originalError } = await supabase
      .from("users")
      .select("id, username, email, name, role")
      .eq("id", originalUserId)
      .single()

    if (originalError || !originalUser) {
      return NextResponse.json(
        { error: "원래 사용자 정보를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    // 현재 사용자 정보 (impersonated user)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: currentUser } = await supabase
      .from("users")
      .select("id, username, name, role")
      .eq("id", user?.id)
      .single()

    // 감사 로그 기록
    await supabase.from("audit_logs").insert({
      user_id: originalUserId,
      action: "impersonate_stop",
      table_name: "users",
      record_id: currentUser?.id || null,
      changes: {
        original_user: originalUser,
        impersonated_user: currentUser,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    })

    // 쿠키 삭제
    cookieStore.delete("original_user_id")

    return NextResponse.json({
      success: true,
      message: "원래 계정으로 복귀했습니다.",
      user: {
        id: originalUser.id,
        username: originalUser.username,
        name: originalUser.name,
        role: originalUser.role,
      },
    })
  } catch (error: any) {
    console.error("Stop impersonate error:", error)
    return NextResponse.json(
      { error: "Impersonate 종료 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/impersonate/stop
 * Impersonate 상태 확인
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const originalUserId = cookieStore.get("original_user_id")?.value

    return NextResponse.json({
      isImpersonating: !!originalUserId,
      originalUserId: originalUserId || null,
    })
  } catch (error: any) {
    console.error("Get impersonate status error:", error)
    return NextResponse.json(
      { error: "상태 조회 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
