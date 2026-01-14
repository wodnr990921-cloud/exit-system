import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkAdminAccess } from "@/lib/.cursorrules/admin"
import { cookies } from "next/headers"

/**
 * POST /api/admin/impersonate
 * 직원 화면 미리보기 (Impersonation)
 *
 * 관리자가 다른 직원의 계정으로 일시적으로 로그인하여 화면을 확인할 수 있습니다.
 * 원래 관리자 계정 정보는 세션에 보관되어 언제든 복귀할 수 있습니다.
 *
 * Body:
 * - targetUserId: string (로그인할 대상 직원 ID)
 *
 * 권한: admin만 접근 가능
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
    const { targetUserId } = body

    if (!targetUserId) {
      return NextResponse.json(
        { error: "대상 사용자 ID를 입력해주세요." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 대상 사용자 정보 조회
    const { data: targetUser, error: targetError } = await supabase
      .from("users")
      .select("id, username, email, name, role")
      .eq("id", targetUserId)
      .single()

    if (targetError || !targetUser) {
      return NextResponse.json(
        { error: "대상 사용자를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    // CEO 계정으로는 Impersonate 불가
    if (targetUser.role === "ceo") {
      return NextResponse.json(
        { error: "CEO 계정으로는 Impersonate할 수 없습니다." },
        { status: 403 }
      )
    }

    // 원래 사용자 정보 저장
    const { data: originalUser } = await supabase
      .from("users")
      .select("id, username, email, name, role")
      .eq("id", userId)
      .single()

    // 쿠키에 원래 사용자 정보 저장
    const cookieStore = await cookies()
    cookieStore.set("original_user_id", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8시간
    })

    // 감사 로그 기록
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "impersonate_start",
      table_name: "users",
      record_id: targetUserId,
      changes: {
        original_user: originalUser,
        target_user: targetUser,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    })

    return NextResponse.json({
      success: true,
      message: `${targetUser.username} 계정으로 전환되었습니다.`,
      impersonatedUser: {
        id: targetUser.id,
        username: targetUser.username,
        name: targetUser.name,
        role: targetUser.role,
      },
      originalUser: {
        id: originalUser?.id,
        username: originalUser?.username,
      },
    })
  } catch (error: any) {
    console.error("Impersonate error:", error)
    return NextResponse.json(
      { error: "Impersonate 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/impersonate
 * 현재 Impersonate 상태 확인
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const originalUserId = cookieStore.get("original_user_id")?.value

    if (!originalUserId) {
      return NextResponse.json({
        isImpersonating: false,
      })
    }

    const supabase = await createClient()

    // 원래 사용자 정보 조회
    const { data: originalUser } = await supabase
      .from("users")
      .select("id, username, name, role")
      .eq("id", originalUserId)
      .single()

    // 현재 사용자 정보 조회
    const { data: { user } } = await supabase.auth.getUser()
    const { data: currentUser } = await supabase
      .from("users")
      .select("id, username, name, role")
      .eq("id", user?.id)
      .single()

    return NextResponse.json({
      isImpersonating: true,
      originalUser: originalUser ? {
        id: originalUser.id,
        username: originalUser.username,
        name: originalUser.name,
        role: originalUser.role,
      } : null,
      currentUser: currentUser ? {
        id: currentUser.id,
        username: currentUser.username,
        name: currentUser.name,
        role: currentUser.role,
      } : null,
    })
  } catch (error: any) {
    console.error("Get impersonate status error:", error)
    return NextResponse.json(
      { error: "상태 조회 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
