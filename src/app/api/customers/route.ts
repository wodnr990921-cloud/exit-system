import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess, checkReadAccess, checkStaffAccess } from "@/lib/.cursorrules/permissions"

/**
 * GET /api/customers
 * 회원 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { hasAccess } = await checkReadAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const limit = searchParams.get("limit")

    let query = supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false })

    // 검색
    if (search) {
      query = query.or(
        `member_number.ilike.%${search}%,name.ilike.%${search}%,institution.ilike.%${search}%,prison_number.ilike.%${search}%`
      )
    }

    // 제한
    if (limit) {
      query = query.limit(parseInt(limit))
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching customers:", error)
      return NextResponse.json(
        { error: "회원 목록을 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      customers: data,
    })
  } catch (error: any) {
    console.error("Customers API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers
 * 신규 회원 등록
 * 권한: employee 이상 (모든 직원)
 */
export async function POST(request: NextRequest) {
  try {
    console.log("=== POST /api/customers 시작 ===")
    const { hasAccess, user } = await checkStaffAccess()
    console.log("권한 체크 결과:", { hasAccess, userId: user?.id })
    
    if (!hasAccess || !user) {
      console.log("권한 없음 - 403 반환")
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const body = await request.json()
    console.log("요청 본문:", body)
    const { name, institution, prison_number, mailbox_address } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "이름은 필수입니다." }, { status: 400 })
    }

    const supabase = await createClient()

    // 회원번호 자동 생성 (가장 최근 회원번호 + 1)
    const { data: lastCustomer } = await supabase
      .from("customers")
      .select("member_number")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    let newMemberNumber = "M0001"
    if (lastCustomer && lastCustomer.member_number) {
      const lastNumber = parseInt(lastCustomer.member_number.replace(/\D/g, ""))
      if (!isNaN(lastNumber)) {
        newMemberNumber = `M${String(lastNumber + 1).padStart(4, "0")}`
      }
    }

    // 회원 등록
    const { data: customer, error: insertError } = await supabase
      .from("customers")
      .insert({
        member_number: newMemberNumber,
        name: name.trim(),
        institution: institution?.trim() || null,
        prison_number: prison_number?.trim() || null,
        mailbox_address: mailbox_address?.trim() || null,
        status: "active",
        point_balance: 0,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error inserting customer:", insertError)
      console.error("상세 에러:", JSON.stringify(insertError, null, 2))
      return NextResponse.json(
        { error: "회원 등록에 실패했습니다.", details: insertError.message, code: insertError.code },
        { status: 500 }
      )
    }

    // 감사 로그 기록
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "insert",
      table_name: "customers",
      record_id: customer.id,
      new_values: customer,
    })

    return NextResponse.json({
      success: true,
      message: "회원이 등록되었습니다.",
      customer,
    })
  } catch (error: any) {
    console.error("Customer creation error:", error)
    console.error("에러 스택:", error.stack)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}
