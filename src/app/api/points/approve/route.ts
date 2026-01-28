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

    // 포인트 거래 정보 조회
    const { data: point, error: pointFetchError } = await supabase
      .from("points")
      .select("*")
      .eq("id", transactionId)
      .single()

    if (pointFetchError || !point) {
      console.error("Point fetch error:", pointFetchError)
      return NextResponse.json({ error: "포인트 거래를 찾을 수 없습니다." }, { status: 404 })
    }

    if (point.status !== "pending") {
      return NextResponse.json({ error: "이미 처리된 거래입니다." }, { status: 400 })
    }

    console.log("Approving point transaction:", {
      id: point.id,
      customer_id: point.customer_id,
      amount: point.amount,
      type: point.type,
      category: point.category
    })

    // 1. 포인트 상태를 approved로 변경
    const { error: approveError } = await supabase
      .from("points")
      .update({
        status: "approved",
        approved_by: user.id,
      })
      .eq("id", transactionId)

    if (approveError) {
      console.error("Approve error:", approveError)
      return NextResponse.json({ error: "승인 처리에 실패했습니다." }, { status: 500 })
    }

    // 2. 회원의 실제 포인트 업데이트
    if (point.customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("total_point_general, total_point_betting")
        .eq("id", point.customer_id)
        .single()

      if (customerError || !customer) {
        console.error("Customer fetch error:", customerError)
        // 롤백
        await supabase
          .from("points")
          .update({ status: "pending", approved_by: null })
          .eq("id", transactionId)
        return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 })
      }

      let newGeneral = customer.total_point_general || 0
      let newBetting = customer.total_point_betting || 0

      // amount 값 그대로 사용: 양수면 추가, 음수면 차감
      if (point.category === "general") {
        newGeneral += point.amount
      } else if (point.category === "betting") {
        newBetting += point.amount
      }

      // 잔액이 음수가 되지 않도록 체크
      if (newGeneral < 0) {
        console.error("Insufficient general points after approval:", {
          current: customer.total_point_general,
          amount: point.amount,
          newBalance: newGeneral
        })
        // 롤백
        await supabase
          .from("points")
          .update({ status: "pending", approved_by: null })
          .eq("id", transactionId)
        return NextResponse.json({ error: "일반 포인트 잔액이 부족합니다." }, { status: 400 })
      }

      if (newBetting < 0) {
        console.error("Insufficient betting points after approval:", {
          current: customer.total_point_betting,
          amount: point.amount,
          newBalance: newBetting
        })
        // 롤백
        await supabase
          .from("points")
          .update({ status: "pending", approved_by: null })
          .eq("id", transactionId)
        return NextResponse.json({ error: "배팅 포인트 잔액이 부족합니다." }, { status: 400 })
      }

      console.log("Updating customer balance:", {
        customerId: point.customer_id,
        oldGeneral: customer.total_point_general,
        oldBetting: customer.total_point_betting,
        newGeneral,
        newBetting,
        pointAmount: point.amount
      })

      // 포인트 업데이트
      const { error: updateError } = await supabase
        .from("customers")
        .update({
          total_point_general: newGeneral,
          total_point_betting: newBetting,
        })
        .eq("id", point.customer_id)

      if (updateError) {
        console.error("Customer update error:", updateError)
        // 롤백
        await supabase
          .from("points")
          .update({ status: "pending", approved_by: null })
          .eq("id", transactionId)
        return NextResponse.json({ error: "포인트 업데이트에 실패했습니다." }, { status: 500 })
      }
    }

    // 승인 성공 시 알림 생성
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
      const customerData = Array.isArray(pointTransaction.customers)
        ? pointTransaction.customers[0]
        : pointTransaction.customers
      const customerId = pointTransaction.customer_id
      const customerName = (customerData as any)?.name

      // 포인트 충전(charge) 승인 시 알림 생성
      if (pointTransaction.type === "charge" || pointTransaction.type === "refund") {
        // 입금 여부 확인 (depositor_name이 있으면 입금으로 간주, 또는 reason에 "입금" 포함)
        const depositorName = (customerData as any)?.depositor_name
        const isDeposit = depositorName || (pointTransaction.reason && pointTransaction.reason.includes("입금"))

        if (isDeposit && depositorName) {
          await createDepositNotification(
            customerId,
            customerName,
            depositorName,
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
    })
  } catch (error: any) {
    console.error("Approve point API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
