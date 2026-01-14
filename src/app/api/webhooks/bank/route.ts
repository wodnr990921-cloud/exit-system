import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/webhooks/bank
 * 은행 입금 알림 Webhook
 * 
 * night_work.md Phase 8 요구사항:
 * - 외부(SMS 앱)에서 입금 알림이 오면 depositor_name과 amount로 충전 신청 내역을 찾아 자동 매칭
 * - 매칭된 건은 '승인 대기(matched)' 상태로 변경
 * - 사장님 대시보드에 알림
 * 
 * Request Body:
 * - depositor_name: string (입금자명)
 * - amount: number (입금 금액)
 * - bank_name?: string (은행명, 선택)
 * - transaction_time?: string (입금 시간, 선택)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { depositor_name, amount, bank_name, transaction_time } = body

    if (!depositor_name || !amount) {
      return NextResponse.json(
        { error: "depositor_name과 amount는 필수입니다." },
        { status: 400 }
      )
    }

    // Admin Client (Service Role Key 사용)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error("❌ SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.")
      return NextResponse.json(
        { error: "서버 설정 오류입니다." },
        { status: 500 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    console.log(`🏦 입금 알림: ${depositor_name}님, ${amount.toLocaleString()}원`)

    // 1. bank_transactions 테이블에 입금 내역 기록
    const { data: transaction, error: transactionError } = await supabase
      .from("bank_transactions")
      .insert({
        depositor_name,
        amount,
        bank_name: bank_name || null,
        transaction_time: transaction_time || new Date().toISOString(),
        transaction_type: "deposit",
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (transactionError) {
      console.error("❌ 은행 거래 기록 실패:", transactionError)
      return NextResponse.json(
        { error: "거래 기록 중 오류가 발생했습니다.", details: transactionError.message },
        { status: 500 }
      )
    }

    console.log("✅ 거래 기록 완료:", transaction.id)

    // 2. 충전 신청 내역(points 테이블)에서 매칭 시도
    // - status = 'pending' (승인 대기)
    // - amount와 일치
    // - 최근 24시간 이내 신청
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: matchingRequests, error: matchError } = await supabase
      .from("points")
      .select("*, customers(name, username)")
      .eq("type", "charge")
      .eq("status", "pending")
      .eq("amount", amount)
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false })

    if (matchError) {
      console.error("❌ 매칭 조회 실패:", matchError)
      return NextResponse.json(
        {
          success: true,
          message: "입금 내역이 기록되었으나, 자동 매칭에 실패했습니다.",
          transaction_id: transaction.id,
        },
        { status: 200 }
      )
    }

    // 3. 매칭 로직: 입금자명과 고객명 비교
    let matchedRequest = null
    if (matchingRequests && matchingRequests.length > 0) {
      // 입금자명에서 공백 제거 후 비교
      const cleanDepositorName = depositor_name.replace(/\s/g, "")
      
      for (const req of matchingRequests) {
        const customerName = (req.customers?.name || req.customers?.username || "").replace(/\s/g, "")
        
        // 입금자명이 고객명에 포함되거나, 고객명이 입금자명에 포함되면 매칭
        if (
          cleanDepositorName.includes(customerName) ||
          customerName.includes(cleanDepositorName)
        ) {
          matchedRequest = req
          break
        }
      }
    }

    // 4. 매칭 성공 시 상태 업데이트
    if (matchedRequest) {
      const { error: updateError } = await supabase
        .from("points")
        .update({
          status: "matched", // 승인 대기 상태로 변경
          updated_at: new Date().toISOString(),
        })
        .eq("id", matchedRequest.id)

      if (updateError) {
        console.error("❌ 매칭 상태 업데이트 실패:", updateError)
      } else {
        console.log(`✅ 자동 매칭 성공: ${matchedRequest.customers?.name || matchedRequest.customer_id}`)
        
        // bank_transactions 상태도 업데이트
        await supabase
          .from("bank_transactions")
          .update({
            status: "matched",
            matched_point_id: matchedRequest.id,
          })
          .eq("id", transaction.id)

        return NextResponse.json({
          success: true,
          message: "입금 확인 및 자동 매칭 완료",
          transaction_id: transaction.id,
          matched_request: {
            id: matchedRequest.id,
            customer_name: matchedRequest.customers?.name || matchedRequest.customers?.username,
            amount: matchedRequest.amount,
          },
        })
      }
    }

    // 5. 매칭 실패
    console.log("⚠️ 자동 매칭 실패: 일치하는 충전 신청을 찾지 못했습니다.")
    return NextResponse.json({
      success: true,
      message: "입금 내역이 기록되었으나, 자동 매칭할 신청 건을 찾지 못했습니다.",
      transaction_id: transaction.id,
      note: "수동으로 매칭이 필요합니다.",
    })

  } catch (error: any) {
    console.error("Bank webhook error:", error)
    return NextResponse.json(
      { error: "Webhook 처리 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webhooks/bank
 * Webhook 상태 확인 (테스트용)
 */
export async function GET() {
  return NextResponse.json({
    status: "active",
    endpoint: "/api/webhooks/bank",
    description: "은행 입금 알림 Webhook",
    usage: {
      method: "POST",
      body: {
        depositor_name: "string (required)",
        amount: "number (required)",
        bank_name: "string (optional)",
        transaction_time: "string (optional, ISO 8601)",
      },
    },
  })
}
