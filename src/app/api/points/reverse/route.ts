import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

/**
 * POST /api/points/reverse
 * 포인트 거래를 취소하고 반대 거래를 생성
 * 권한: operator 이상
 */
export async function POST(request: NextRequest) {
  try {
    // 권한 확인
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { transactionId, reason } = await request.json()

    if (!transactionId || !reason) {
      return NextResponse.json(
        { error: "거래 ID와 취소 사유가 필요합니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // RPC 함수를 사용하여 포인트 거래 취소 및 반대 거래 생성
    const { data: rpcResult, error: rpcError } = await supabase.rpc("reverse_point_transaction", {
      transaction_id: transactionId,
      reversal_reason: reason,
      operator_id: user.id,
    })

    if (rpcError) {
      console.error("RPC error:", rpcError)
      return NextResponse.json(
        { error: "거래 취소에 실패했습니다.", details: rpcError.message },
        { status: 500 }
      )
    }

    if (!rpcResult || !rpcResult.success) {
      return NextResponse.json(
        { error: rpcResult?.error || "거래 취소에 실패했습니다." },
        { status: 400 }
      )
    }

    // 감사 로그 생성
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "reverse_transaction",
      table_name: "points",
      record_id: transactionId,
      changes: {
        reason: reason,
        result: rpcResult,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "거래가 취소되었습니다.",
      data: rpcResult,
    })
  } catch (error: any) {
    console.error("Reverse point API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
