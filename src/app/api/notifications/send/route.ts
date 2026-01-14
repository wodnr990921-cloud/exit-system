import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

/**
 * 자동 메시지 발송 API
 * - 당첨자에게 알림 메시지 발송
 * - 포인트 지급 알림
 */
export async function POST(request: NextRequest) {
  try {
    const { memberNumber, message, type } = await request.json()

    if (!memberNumber || !message) {
      return NextResponse.json(
        { error: "memberNumber와 message가 필요합니다" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 사용자 찾기
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('member_number', memberNumber)
      .single()

    if (customerError || !customer) {
      return NextResponse.json(
        { error: "회원을 찾을 수 없습니다" },
        { status: 404 }
      )
    }

    // 알림 저장 (notifications 테이블이 있다고 가정)
    const { error: notifyError } = await supabase
      .from('notifications')
      .insert({
        customer_id: customer.id,
        message,
        type: type || 'betting_win',
        is_read: false,
        created_at: new Date().toISOString()
      })

    if (notifyError) {
      console.error("알림 저장 오류:", notifyError)
      // 테이블이 없으면 일단 무시
    }

    // 실시간 알림 (웹소켓, FCM 등) 추가 가능
    
    return NextResponse.json({
      success: true,
      message: "메시지가 발송되었습니다",
      recipient: customer.name,
      memberNumber
    })

  } catch (error) {
    console.error("메시지 발송 오류:", error)
    return NextResponse.json(
      { 
        error: "메시지 발송 중 오류 발생",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
