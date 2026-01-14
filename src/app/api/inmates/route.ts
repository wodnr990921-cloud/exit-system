import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess, checkReadAccess } from "@/lib/.cursorrules/permissions"

/**
 * GET /api/inmates
 * 수용자 목록 조회 (필터링: prison, is_released)
 */
export async function GET(request: NextRequest) {
  try {
    const { hasAccess } = await checkReadAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const prison = searchParams.get("prison")
    const isReleased = searchParams.get("is_released")
    const search = searchParams.get("search")

    let query = supabase
      .from("inmates")
      .select(
        `
        *,
        prison:prisons!inmates_prison_id_fkey (
          id,
          name,
          code,
          region
        ),
        customer:customers!inmates_customer_id_fkey (
          id,
          member_number,
          name,
          phone
        )
      `
      )
      .order("created_at", { ascending: false })

    // 교도소 필터
    if (prison) {
      const { data: prisons } = await supabase
        .from("prisons")
        .select("id")
        .ilike("name", `%${prison}%`)

      if (prisons && prisons.length > 0) {
        const prisonIds = prisons.map((p) => p.id)
        query = query.in("prison_id", prisonIds)
      }
    }

    // 출소 여부 필터
    if (isReleased !== null && isReleased !== undefined) {
      query = query.eq("is_released", isReleased === "true")
    }

    // 검색 (이름, 수용번호)
    if (search) {
      query = query.or(`name.ilike.%${search}%,inmate_number.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching inmates:", error)
      return NextResponse.json(
        { error: "수용자 목록을 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    // 통계
    const stats = {
      total: data.length,
      active: data.filter((i: any) => !i.is_released).length,
      released: data.filter((i: any) => i.is_released).length,
    }

    return NextResponse.json({
      success: true,
      inmates: data,
      stats,
    })
  } catch (error: any) {
    console.error("Inmates API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inmates
 * 수용자 등록
 * 권한: operator 이상
 */
export async function POST(request: NextRequest) {
  try {
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const {
      prisonId,
      customerId,
      name,
      inmateNumber,
      dateOfBirth,
      admissionDate,
      releaseDate,
      notes,
    } = await request.json()

    if (!prisonId || !name || !inmateNumber) {
      return NextResponse.json(
        { error: "교도소, 이름, 수용번호는 필수입니다." },
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

    // 고객 확인 (선택)
    if (customerId) {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .single()

      if (customerError || !customer) {
        return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 })
      }
    }

    // 중복 확인 (같은 교도소에 같은 수용번호)
    const { data: existing } = await supabase
      .from("inmates")
      .select("id")
      .eq("prison_id", prisonId)
      .eq("inmate_number", inmateNumber)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: "이미 등록된 수용번호입니다." },
        { status: 400 }
      )
    }

    // 수용자 등록
    const { data: inserted, error: insertError } = await supabase
      .from("inmates")
      .insert({
        prison_id: prisonId,
        customer_id: customerId || null,
        name,
        inmate_number: inmateNumber,
        date_of_birth: dateOfBirth || null,
        admission_date: admissionDate || new Date().toISOString(),
        expected_release_date: releaseDate || null,
        is_released: false,
        notes: notes || "",
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating inmate:", insertError)
      return NextResponse.json({ error: "수용자 등록에 실패했습니다." }, { status: 500 })
    }

    // 감사 로그
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_inmate",
      table_name: "inmates",
      record_id: inserted.id,
      changes: { inserted },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "수용자가 등록되었습니다.",
      inmate: inserted,
    })
  } catch (error: any) {
    console.error("Inmate create API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inmates
 * 수용자 정보 수정
 * 권한: operator 이상
 */
export async function PUT(request: NextRequest) {
  try {
    const { hasAccess, user } = await checkOperatorOrCEOAccess()
    if (!hasAccess || !user) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const {
      inmateId,
      prisonId,
      customerId,
      name,
      inmateNumber,
      dateOfBirth,
      admissionDate,
      expectedReleaseDate,
      actualReleaseDate,
      isReleased,
      notes,
    } = await request.json()

    if (!inmateId) {
      return NextResponse.json({ error: "수용자 ID가 필요합니다." }, { status: 400 })
    }

    const supabase = await createClient()

    // 수용자 정보 조회
    const { data: existing, error: fetchError } = await supabase
      .from("inmates")
      .select("*")
      .eq("id", inmateId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "수용자를 찾을 수 없습니다." }, { status: 404 })
    }

    // 수정할 데이터 준비
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (prisonId !== undefined) updateData.prison_id = prisonId
    if (customerId !== undefined) updateData.customer_id = customerId
    if (name !== undefined) updateData.name = name
    if (inmateNumber !== undefined) updateData.inmate_number = inmateNumber
    if (dateOfBirth !== undefined) updateData.date_of_birth = dateOfBirth
    if (admissionDate !== undefined) updateData.admission_date = admissionDate
    if (expectedReleaseDate !== undefined)
      updateData.expected_release_date = expectedReleaseDate
    if (actualReleaseDate !== undefined) updateData.actual_release_date = actualReleaseDate
    if (isReleased !== undefined) {
      updateData.is_released = isReleased
      if (isReleased && !actualReleaseDate) {
        updateData.actual_release_date = new Date().toISOString()
      }
    }
    if (notes !== undefined) updateData.notes = notes

    // 수용자 정보 수정
    const { data: updated, error: updateError } = await supabase
      .from("inmates")
      .update(updateData)
      .eq("id", inmateId)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating inmate:", updateError)
      return NextResponse.json({ error: "수용자 정보 수정에 실패했습니다." }, { status: 500 })
    }

    // 감사 로그
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "update_inmate",
      table_name: "inmates",
      record_id: inmateId,
      changes: {
        old: existing,
        new: updated,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "수용자 정보가 수정되었습니다.",
      inmate: updated,
    })
  } catch (error: any) {
    console.error("Inmate update API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
