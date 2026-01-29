import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hasMinimumRole } from "@/lib/permissions"

/**
 * 배팅 배당 수정 (관리자급만 가능)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 사용자 권한 확인
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // 관리자급만 배당 수정 가능
    if (!hasMinimumRole(userData.role, "operator")) {
      return NextResponse.json(
        { error: "배당 수정은 관리자급 이상만 가능합니다." },
        { status: 403 }
      )
    }

    const { task_item_id, betting_odds } = await request.json()

    if (!task_item_id || betting_odds === null || betting_odds === undefined) {
      return NextResponse.json({ error: "필수 정보가 누락되었습니다." }, { status: 400 })
    }

    if (betting_odds <= 0) {
      return NextResponse.json({ error: "배당은 0보다 커야 합니다." }, { status: 400 })
    }

    // task_item 조회
    const { data: taskItem, error: fetchError } = await supabase
      .from("task_items")
      .select("id, task_id, amount, betting_choice")
      .eq("id", task_item_id)
      .eq("task_id", taskId)
      .single()

    if (fetchError || !taskItem) {
      return NextResponse.json({ error: "배팅 항목을 찾을 수 없습니다." }, { status: 404 })
    }

    // 예상 당첨금 재계산
    const potential_win = Math.floor(taskItem.amount * betting_odds)

    // 배당 및 예상 당첨금 업데이트
    const { error: updateError } = await supabase
      .from("task_items")
      .update({
        betting_odds,
        potential_win,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task_item_id)

    if (updateError) {
      console.error("Update betting odds error:", updateError)
      return NextResponse.json({ error: "배당 수정에 실패했습니다." }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `배당이 ${betting_odds}배로 설정되었습니다. (예상 당첨금: ${potential_win.toLocaleString()}P)`,
      data: {
        betting_odds,
        potential_win,
      },
    })
  } catch (error: any) {
    console.error("Update betting odds API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
