import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * 일일 알림 메시지 취합 API
 * 특정 회원의 당일 미전송 알림 메시지를 취합하여 티켓 답변에 포함
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("customerId")
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0]

    if (!customerId) {
      return NextResponse.json({ error: "회원 ID가 필요합니다." }, { status: 400 })
    }

    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    // 당일 미전송 알림 메시지 조회
    const { data: notifications, error } = await supabase
      .from("customer_notifications")
      .select("*")
      .eq("customer_id", customerId)
      .eq("sent", false)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching notifications:", error)
      return NextResponse.json({ error: "알림 메시지를 불러오는데 실패했습니다." }, { status: 500 })
    }

    // 알림 메시지를 하나의 텍스트로 취합
    const aggregatedMessage = notifications
      ?.map((notif) => notif.message)
      .join("\n\n") || ""

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      aggregatedMessage,
      count: notifications?.length || 0,
    })
  } catch (error: any) {
    console.error("Daily notifications API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * 알림 메시지 전송 완료 처리 API
 * 티켓 답변에 포함된 알림 메시지를 'sent=true'로 마킹
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { notificationIds, taskId } = await request.json()

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json({ error: "알림 ID 목록이 필요합니다." }, { status: 400 })
    }

    // 알림 메시지를 전송 완료로 마킹
    const { error } = await supabase
      .from("customer_notifications")
      .update({
        sent: true,
        sent_at: new Date().toISOString(),
      })
      .in("id", notificationIds)

    if (error) {
      console.error("Error marking notifications as sent:", error)
      return NextResponse.json({ error: "알림 메시지 업데이트에 실패했습니다." }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "알림 메시지가 전송 완료로 마킹되었습니다.",
      count: notificationIds.length,
    })
  } catch (error: any) {
    console.error("Mark notifications sent API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
