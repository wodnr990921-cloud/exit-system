import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { checkAdminAccess } from "@/lib/.cursorrules/admin"

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const { isAdmin, userId } = await checkAdminAccess()
    if (!isAdmin || !userId) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { username, password, name, role } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호는 필수입니다." },
        { status: 400 }
      )
    }

    // role 검증 (admin, operator, employee 모두 허용)
    if (!role || !["admin", "operator", "employee"].includes(role)) {
      return NextResponse.json(
        { error: "올바른 계정 유형을 선택해주세요." },
        { status: 400 }
      )
    }

    // username 처리: 이메일 형식이면 @ 앞부분만 추출
    let cleanUsername = username.trim()
    if (cleanUsername.includes('@')) {
      cleanUsername = cleanUsername.split('@')[0]
    }
    
    // username 유효성 검사 (3-20자, 영문/숫자/언더스코어만)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      return NextResponse.json(
        { error: "아이디는 3-20자의 영문, 숫자, 언더스코어만 사용할 수 있습니다." },
        { status: 400 }
      )
    }
    
    // cleanUsername 사용
    const finalUsername = cleanUsername

    const supabase = await createClient()

    // username 중복 확인 (cleanUsername 사용)
    const { data: existingUser } = await supabase
      .from("users")
      .select("username")
      .eq("username", finalUsername)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디입니다." },
        { status: 400 }
      )
    }

    // 가상 이메일 생성 (실제 유효한 도메인 사용)
    const uuid = crypto.randomUUID().replace(/-/g, '')
    const email = `${finalUsername}_${uuid.slice(0, 16)}@mail.com`

    // Supabase Auth에 사용자 생성
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: finalUsername,
          name: name || "",
          role: role,
        },
        emailRedirectTo: undefined, // 이메일 인증 비활성화
      },
    })

    if (error) {
      if (error.message.includes("already registered")) {
        return NextResponse.json(
          { error: "이미 사용 중인 아이디입니다." },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: error.message || "사용자 생성에 실패했습니다." },
        { status: 400 }
      )
    }

    // users 테이블에 직접 추가 (트리거가 작동하지 않는 경우 대비)
    if (data.user) {
      const { error: dbError } = await supabase.from("users").upsert({
        id: data.user.id,
        username: finalUsername,
        email,
        name: name || "",
        role: role as "admin" | "operator" | "employee",
      })

      if (dbError) {
        console.error("Database error:", dbError)
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user?.id,
        username: finalUsername,
        name: name || "",
        role: role,
      },
      message: "계정이 성공적으로 생성되었습니다.",
    })
  } catch (error: any) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
