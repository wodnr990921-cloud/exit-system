import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkAdminAccess } from "@/lib/.cursorrules/admin"

/**
 * POST /api/admin/preview
 * 직원 화면 미리보기 (관리자가 직원 계정으로 시스템 보기)
 *
 * Request Body:
 * - employeeId: string (미리보기할 직원의 user ID)
 * - action: "start" | "stop"
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

    const { employeeId, action } = await request.json()

    if (!action || !["start", "stop"].includes(action)) {
      return NextResponse.json(
        { error: "유효한 action을 제공해주세요. (start | stop)" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    if (action === "start") {
      if (!employeeId) {
        return NextResponse.json(
          { error: "employeeId가 필요합니다." },
          { status: 400 }
        )
      }

      // 대상 직원 정보 조회
      const { data: employee, error: employeeError } = await supabase
        .from("users")
        .select("id, username, name, email, role")
        .eq("id", employeeId)
        .single()

      if (employeeError || !employee) {
        return NextResponse.json(
          { error: "직원을 찾을 수 없습니다." },
          { status: 404 }
        )
      }

      // 감사 로그 기록
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action: "start_preview",
        table_name: "users",
        record_id: employeeId,
        changes: {
          preview_target: employee,
          admin_id: userId,
        },
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      })

      return NextResponse.json({
        success: true,
        message: `${employee.name || employee.username}님의 화면 미리보기를 시작합니다.`,
        preview: {
          employeeId: employee.id,
          employeeName: employee.name || employee.username,
          employeeRole: employee.role,
          employeeEmail: employee.email,
        },
      })
    } else if (action === "stop") {
      // 미리보기 종료 감사 로그
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action: "stop_preview",
        table_name: "users",
        record_id: employeeId || null,
        changes: {
          admin_id: userId,
        },
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      })

      return NextResponse.json({
        success: true,
        message: "화면 미리보기를 종료했습니다.",
      })
    }

    return NextResponse.json(
      { error: "알 수 없는 오류가 발생했습니다." },
      { status: 500 }
    )
  } catch (error: any) {
    console.error("Preview API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/preview
 * 현재 미리보기 상태 확인
 */
export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const { isAdmin, userId } = await checkAdminAccess()
    if (!isAdmin || !userId) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      )
    }

    // 쿠키나 세션에서 현재 미리보기 상태 확인
    // (실제 구현에서는 세션 스토어 사용 권장)
    const previewEmployeeId = request.cookies.get("preview_employee_id")?.value

    if (previewEmployeeId) {
      const supabase = await createClient()
      const { data: employee } = await supabase
        .from("users")
        .select("id, username, name, role")
        .eq("id", previewEmployeeId)
        .single()

      return NextResponse.json({
        success: true,
        isPreviewMode: true,
        preview: employee
          ? {
              employeeId: employee.id,
              employeeName: employee.name || employee.username,
              employeeRole: employee.role,
            }
          : null,
      })
    }

    return NextResponse.json({
      success: true,
      isPreviewMode: false,
      preview: null,
    })
  } catch (error: any) {
    console.error("Preview status API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
