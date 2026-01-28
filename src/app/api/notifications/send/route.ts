import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendNotificationToUser } from "@/lib/notification-manager"

/**
 * 특정 사용자에게 알림 전송
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userId, type, title, message, data, timestamp } = await request.json()

    if (!userId || !type || !title || !message) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다." },
        { status: 400 }
      )
    }

    const notification = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      type,
      title,
      message,
      timestamp: timestamp || new Date().toISOString(),
      data
    }

    const sent = sendNotificationToUser(userId, notification)

    return NextResponse.json({
      success: sent,
      message: sent ? "알림이 전송되었습니다." : "사용자가 연결되어 있지 않습니다."
    })

  } catch (error: any) {
    console.error("Send Notification Error:", error)
    return NextResponse.json(
      { error: "알림 전송 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
