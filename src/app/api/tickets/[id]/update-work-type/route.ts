import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { work_type } = await request.json()

    if (!work_type) {
      return NextResponse.json({ error: "업무 유형이 필요합니다." }, { status: 400 })
    }

    // 티켓 업무 유형 업데이트
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ work_type })
      .eq("id", id)

    if (updateError) {
      console.error("Update work_type error:", updateError)
      return NextResponse.json({ error: "업무 유형 수정에 실패했습니다." }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "업무 유형이 수정되었습니다.",
    })
  } catch (error: any) {
    console.error("Update work_type API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
