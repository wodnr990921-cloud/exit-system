import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkAdminAccess } from "@/lib/.cursorrules/admin"
import { checkReadAccess } from "@/lib/.cursorrules/permissions"

/**
 * GET /api/config
 * 모든 설정 조회 또는 특정 설정 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 읽기 권한 확인
    const { hasAccess } = await checkReadAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")

    if (key) {
      // 특정 설정 조회
      const { data, error } = await supabase
        .from("system_config")
        .select("*")
        .eq("config_key", key)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          return NextResponse.json({ error: "설정을 찾을 수 없습니다." }, { status: 404 })
        }
        console.error("Error fetching config:", error)
        return NextResponse.json(
          { error: "설정을 불러오는데 실패했습니다." },
          { status: 500 }
        )
      }

      // 컬럼명 매핑
      const mapped = {
        ...data,
        key: data.config_key,
        value: data.config_value,
      }
      return NextResponse.json({ success: true, config: mapped })
    } else {
      // 모든 설정 조회
      const { data, error } = await supabase
        .from("system_config")
        .select("*")
        .order("category", { ascending: true })
        .order("key", { ascending: true })

      if (error) {
        console.error("Error fetching configs:", error)
        return NextResponse.json(
          { error: "설정을 불러오는데 실패했습니다." },
          { status: 500 }
        )
      }

      // 컬럼명 매핑
      const mappedData = data.map((config: any) => ({
        ...config,
        key: config.config_key,
        value: config.config_value,
      }))

      // 카테고리별로 그룹화
      const groupedConfigs = mappedData.reduce(
        (acc: any, config: any) => {
          const category = config.category || "기타"
          if (!acc[category]) {
            acc[category] = []
          }
          acc[category].push(config)
          return acc
        },
        {}
      )

      return NextResponse.json({ success: true, configs: mappedData, groupedConfigs })
    }
  } catch (error: any) {
    console.error("Config API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/config
 * 설정 업데이트
 * 권한: admin만
 */
export async function PUT(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const { isAdmin: hasAdminAccess, userId } = await checkAdminAccess()
    if (!hasAdminAccess) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })
    }

    const { key, value, description } = await request.json()

    if (!key) {
      return NextResponse.json({ error: "설정 키가 필요합니다." }, { status: 400 })
    }

    const supabase = await createClient()

    // 기존 설정 조회
    const { data: existingConfig } = await supabase
      .from("system_config")
      .select("*")
      .eq("config_key", key)
      .single()

    let result
    if (existingConfig) {
      // 업데이트
      const updateData: any = {
        config_value: value,
        updated_at: new Date().toISOString(),
      }

      if (description !== undefined) {
        updateData.description = description
      }

      const { data, error } = await supabase
        .from("system_config")
        .update(updateData)
        .eq("config_key", key)
        .select()
        .single()

      if (error) {
        console.error("Error updating config:", error)
        return NextResponse.json(
          { error: "설정 업데이트에 실패했습니다." },
          { status: 500 }
        )
      }

      result = data
    } else {
      // 새로 생성
      const { data, error } = await supabase
        .from("system_config")
        .insert({
          key,
          value,
          description: description || "",
          category: "기타",
        })
        .select()
        .single()

      if (error) {
        console.error("Error creating config:", error)
        return NextResponse.json(
          { error: "설정 생성에 실패했습니다." },
          { status: 500 }
        )
      }

      result = data
    }

    // 감사 로그 생성
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: existingConfig ? "update_config" : "create_config",
      table_name: "system_config",
      record_id: key,
      changes: {
        old: existingConfig || null,
        new: result,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "설정이 업데이트되었습니다.",
      config: result,
    })
  } catch (error: any) {
    console.error("Config update API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/config
 * 설정 삭제
 * 권한: admin만
 */
export async function DELETE(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const { isAdmin: hasAdminAccess, userId } = await checkAdminAccess()
    if (!hasAdminAccess) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")

    if (!key) {
      return NextResponse.json({ error: "설정 키가 필요합니다." }, { status: 400 })
    }

    const supabase = await createClient()

    // 기존 설정 조회
    const { data: existingConfig } = await supabase
      .from("system_config")
      .select("*")
      .eq("config_key", key)
      .single()

    if (!existingConfig) {
      return NextResponse.json({ error: "설정을 찾을 수 없습니다." }, { status: 404 })
    }

    // 삭제
    const { error } = await supabase.from("system_config").delete().eq("config_key", key)

    if (error) {
      console.error("Error deleting config:", error)
      return NextResponse.json({ error: "설정 삭제에 실패했습니다." }, { status: 500 })
    }

    // 감사 로그 생성
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "delete_config",
      table_name: "system_config",
      record_id: key,
      changes: {
        deleted: existingConfig,
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

    return NextResponse.json({
      success: true,
      message: "설정이 삭제되었습니다.",
    })
  } catch (error: any) {
    console.error("Config delete API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
