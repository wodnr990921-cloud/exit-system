import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createChargeNotification,
  createDepositNotification,
} from "@/lib/.cursorrules/notifications"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { transactionId } = await request.json()

    if (!transactionId) {
      return NextResponse.json({ error: "거래 ID가 필요합니다." }, { status: 400 })
    }

    // RPC 함수 호출하여 포인트 승인
    const { data: rpcResult, error: rpcError } = await supabase.rpc("approve_point_transaction", {
      transaction_id: transactionId,
      approver_id: user.id,
    })

    if (rpcError) {
      console.error("RPC error:", rpcError)
      return NextResponse.json({ error: "승인 처리 중 오류가 발생했습니다." }, { status: 500 })
    }

    if (!rpcResult || !rpcResult.success) {
      return NextResponse.json({ error: rpcResult?.error || "승인에 실패했습니다." }, { status: 400 })
    }

    // 승인 성공 시 알림 생성
    // 거래 정보 조회
    const { data: pointTransaction, error: pointError } = await supabase
      .from("points")
      .select(
        `
        id,
        customer_id,
        amount,
        category,
        type,
        reason,
        customers:customers!points_customer_id_fkey (
          id,
          name,
          depositor_name
        )
      `
      )
      .eq("id", transactionId)
      .single()

    if (!pointError && pointTransaction && pointTransaction.customers) {
      const customer = pointTransaction.customers
      const customerId = pointTransaction.customer_id
      const customerName = customer.name

      // 포인트 충전(charge) 승인 시 알림 생성
      if (pointTransaction.type === "charge") {
        // 입금 여부 확인 (depositor_name이 있으면 입금으로 간주, 또는 reason에 "입금" 포함)
        const isDeposit = customer.depositor_name || (pointTransaction.reason && pointTransaction.reason.includes("입금"))
        
        if (isDeposit && customer.depositor_name) {
          await createDepositNotification(
            customerId,
            customerName,
            customer.depositor_name,
            pointTransaction.amount,
            transactionId
          )
        } else {
          // 일반 충전
          await createChargeNotification(
            customerId,
            customerName,
            pointTransaction.amount,
            pointTransaction.category as "general" | "betting",
            transactionId
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "승인되었습니다.",
      result: rpcResult,
    })
  } catch (error: any) {
    console.error("Approve point API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
