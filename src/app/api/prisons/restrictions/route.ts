import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess, checkReadAccess } from "@/lib/.cursorrules/permissions"

/**
 * GET /api/prisons/restrictions
 * 특정 교도소의 금지물품 조회
 * 쿼리 파라미터: prisonName
 */
export async function GET(request: NextRequest) {
  try {
    const { hasAccess } = await checkReadAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const prisonName = searchParams.get("prisonName")

    let query = supabase
      .from("prison_restrictions")
      .select(
        `
        *,
        prison:prisons!prison_restrictions_prison_id_fkey (
          id,
          name,
          code,
          region
        )
      `
      )
      .order("category", { ascending: true })

    if (prisonName) {
      // 교도소 이름으로 필터링
      const { data: prisons, error: prisonError } = await supabase
        .from("prisons")
        .select("id")
        .ilike("name", `%${prisonName}%`)

      if (prisonError) {
        console.error("Error fetching prison:", prisonError)
        return NextResponse.json(
          { error: "교도소 정보를 불러오는데 실패했습니다." },
          { status: 500 }
        )
      }

      if (prisons.length === 0) {
        return NextResponse.json({
          success: true,
          restrictions: [],
          stats: {
            total: 0,
            byCategory: {},
          },
        })
      }

      const prisonIds = prisons.map((p) => p.id)
      query = query.in("prison_id", prisonIds)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching prison restrictions:", error)
      return NextResponse.json(
        { error: "금지물품 목록을 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    // 카테고리별 통계
    const byCategory = data.reduce((acc: any, item: any) => {
      const category = item.category || "기타"
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      restrictions: data,
      stats: {
        total: data.length,
        byCategory,
      },
    })
  } catch (error: any) {
    console.error("Prison restrictions API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/prisons/restrictions
 * 금지물품 추가/수정
 * 권한: operator 이상
 */
export async function POST(request: NextRequest) {
  try {
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { prisonId, itemName, category, description, severity, notes } =
      await request.json()

    if (!prisonId || !itemName || !category) {
      return NextResponse.json(
        { error: "교도소 ID, 물품명, 카테고리는 필수입니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 교도소 확인
    const { data: prison, error: prisonError } = await supabase
      .from("prisons")
      .select("id, name")
      .eq("id", prisonId)
      .single()

    if (prisonError || !prison) {
      return NextResponse.json({ error: "교도소를 찾을 수 없습니다." }, { status: 404 })
    }

    // 중복 확인
    const { data: existing } = await supabase
      .from("prison_restrictions")
      .select("id")
      .eq("prison_id", prisonId)
      .eq("item_name", itemName)
      .single()

    if (existing) {
      // 기존 항목 수정
      const { data: updated, error: updateError } = await supabase
        .from("prison_restrictions")
        .update({
          category,
          description: description || "",
          severity: severity || "medium",
          notes: notes || "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single()

      if (updateError) {
        console.error("Error updating restriction:", updateError)
        return NextResponse.json(
          { error: "금지물품 수정에 실패했습니다." },
          { status: 500 }
        )
      }

      // 감사 로그
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "update_prison_restriction",
        table_name: "prison_restrictions",
        record_id: updated.id,
        changes: { updated },
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      })

      return NextResponse.json({
        success: true,
        message: "금지물품이 수정되었습니다.",
        restriction: updated,
      })
    } else {
      // 새 항목 추가
      const { data: inserted, error: insertError } = await supabase
        .from("prison_restrictions")
        .insert({
          prison_id: prisonId,
          item_name: itemName,
          category,
          description: description || "",
          severity: severity || "medium",
          notes: notes || "",
          created_by: user.id,
        })
        .select()
        .single()

      if (insertError) {
        console.error("Error creating restriction:", insertError)
        return NextResponse.json(
          { error: "금지물품 추가에 실패했습니다." },
          { status: 500 }
        )
      }

      // 감사 로그
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "create_prison_restriction",
        table_name: "prison_restrictions",
        record_id: inserted.id,
        changes: { inserted },
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      })

      return NextResponse.json({
        success: true,
        message: "금지물품이 추가되었습니다.",
        restriction: inserted,
      })
    }
  } catch (error: any) {
    console.error("Prison restrictions create/update API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
