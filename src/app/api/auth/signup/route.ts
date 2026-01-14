import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, name } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호는 필수입니다." },
        { status: 400 }
      )
    }

    // username 유효성 검사
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "아이디는 3-20자의 영문, 숫자, 언더스코어만 사용할 수 있습니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // username 중복 확인
    const { data: existingUser } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디입니다." },
        { status: 400 }
      )
    }

    // 가상 이메일 생성 (실제 유효한 도메인 사용)
    const uuid = crypto.randomUUID().replace(/-/g, '')
    const email = `${username}_${uuid.slice(0, 16)}@mail.com`

    // role 확인 (operator, employee 허용, admin은 Supabase Dashboard에서만 생성 권장)
    const role = body.role || "operator"
    if (!["operator", "employee"].includes(role)) {
      return NextResponse.json(
        { error: "오퍼레이터 또는 직원으로만 가입할 수 있습니다." },
        { status: 400 }
      )
    }

    // Supabase Auth에 사용자 생성
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
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
        { error: error.message || "회원가입에 실패했습니다." },
        { status: 400 }
      )
    }

    // users 테이블에 사용자 정보 추가
    if (data.user) {
      const { error: dbError } = await supabase.from("users").upsert({
        id: data.user.id,
        username,
        email,
        name: name || "",
        role: role,
      })

      if (dbError) {
        console.error("Database error:", dbError)
      }
    }

    return NextResponse.json({
      success: true,
      message: "회원가입이 완료되었습니다!",
      user: {
        username,
        name: name || "",
      },
    })
  } catch (error: any) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "회원가입 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
