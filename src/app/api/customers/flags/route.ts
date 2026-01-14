import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

/**
 * GET /api/customers/flags
 * 고객 플래그 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { hasAccess } = await checkOperatorOrCEOAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("customerId")
    const flagType = searchParams.get("flagType")

    let query = supabase
      .from("customer_flags")
      .select(
        `
        *,
        customer:customers!customer_flags_customer_id_fkey (
          id,
          member_number,
          name
        ),
        created_by_user:users!customer_flags_created_by_fkey (
          id,
          username
        )
      `
      )
      .order("created_at", { ascending: false })

    if (customerId) {
      query = query.eq("customer_id", customerId)
    }

    if (flagType) {
      query = query.eq("flag_type", flagType)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching customer flags:", error)
      return NextResponse.json(
        { error: "고객 플래그를 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      flags: data,
    })
  } catch (error: any) {
    console.error("Customer flags API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/flags
 * 블랙리스트/플래그 추가
 * 권한: operator 이상
 */
export async function POST(request: NextRequest) {
  try {
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { customerId, flagType, reason, severity, expiresAt } = await request.json()

    if (!customerId || !flagType || !reason) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해주세요." },
        { status: 400 }
      )
    }

    // flagType 검증
    const validFlagTypes = ["blacklist", "warning", "suspicious", "vip", "note"]
    if (!validFlagTypes.includes(flagType)) {
      return NextResponse.json(
        { error: "유효하지 않은 플래그 유형입니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 고객 존재 확인
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, name, member_number")
      .eq("id", customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 })
    }

    // 플래그 생성
    const { data: flag, error: insertError } = await supabase
      .from("customer_flags")
      .insert({
        customer_id: customerId,
        flag_type: flagType,
        reason,
        severity: severity || "medium",
        created_by: user.id,
        expires_at: expiresAt || null,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating customer flag:", insertError)
      return NextResponse.json(
        { error: "플래그 생성에 실패했습니다." },
        { status: 500 }
      )
    }

    // 블랙리스트의 경우 고객 상태 업데이트
    if (flagType === "blacklist") {
      await supabase
        .from("customers")
        .update({
          is_blacklisted: true,
          blacklist_reason: reason,
        })
        .eq("id", customerId)
    }

    // 감사 로그
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_customer_flag",
      table_name: "customer_flags",
      record_id: flag.id,
      changes: {
        customer: customer,
        flag: flag,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "플래그가 추가되었습니다.",
      flag,
    })
  } catch (error: any) {
    console.error("Customer flag create API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customers/flags
 * 플래그 제거
 * 권한: operator 이상
 */
export async function DELETE(request: NextRequest) {
  try {
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const flagId = searchParams.get("flagId")

    if (!flagId) {
      return NextResponse.json({ error: "플래그 ID가 필요합니다." }, { status: 400 })
    }

    const supabase = await createClient()

    // 플래그 정보 조회
    const { data: flag, error: fetchError } = await supabase
      .from("customer_flags")
      .select(
        `
        *,
        customer:customers!customer_flags_customer_id_fkey (
          id,
          name
        )
      `
      )
      .eq("id", flagId)
      .single()

    if (fetchError || !flag) {
      return NextResponse.json({ error: "플래그를 찾을 수 없습니다." }, { status: 404 })
    }

    // 플래그 비활성화 (삭제하지 않고 기록 보존)
    const { error: updateError } = await supabase
      .from("customer_flags")
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
        removed_by: user.id,
      })
      .eq("id", flagId)

    if (updateError) {
      console.error("Error removing customer flag:", updateError)
      return NextResponse.json({ error: "플래그 제거에 실패했습니다." }, { status: 500 })
    }

    // 블랙리스트 해제인 경우 고객 상태 업데이트
    if (flag.flag_type === "blacklist") {
      // 다른 활성 블랙리스트 플래그가 있는지 확인
      const { data: otherBlacklists } = await supabase
        .from("customer_flags")
        .select("id")
        .eq("customer_id", flag.customer_id)
        .eq("flag_type", "blacklist")
        .eq("is_active", true)
        .neq("id", flagId)

      // 다른 블랙리스트가 없으면 고객 상태 해제
      if (!otherBlacklists || otherBlacklists.length === 0) {
        await supabase
          .from("customers")
          .update({
            is_blacklisted: false,
            blacklist_reason: null,
          })
          .eq("id", flag.customer_id)
      }
    }

    // 감사 로그
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "remove_customer_flag",
      table_name: "customer_flags",
      record_id: flagId,
      changes: {
        removed: flag,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "플래그가 제거되었습니다.",
    })
  } catch (error: any) {
    console.error("Customer flag delete API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
