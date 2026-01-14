import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import crypto from "crypto"

// Admin 클라이언트 생성 (Service Role Key 사용)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceRoleKey) {
    // Service Role Key가 없으면 null 반환 (대안 방법 사용)
    return null
  }
  
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// 임시 비밀번호 생성 함수 (8자리 영문+숫자 조합)
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let password = ""
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// 비밀번호 해시 함수 (간단한 해시 - 실제로는 bcrypt 등 사용 권장)
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex")
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, action } = body

    if (!username) {
      return NextResponse.json(
        { error: "아이디를 입력해주세요." },
        { status: 400 }
      )
    }

    // Admin 클라이언트 시도 (있으면 사용, 없으면 일반 클라이언트)
    const adminClient = createAdminClient()
    const supabase = await createClient()
    const queryClient = adminClient || supabase

    // username으로 사용자 찾기
    const { data: userData, error: userError } = await queryClient
      .from("users")
      .select("id, email, username, name")
      .eq("username", username)
      .single()

    if (userError) {
      console.error("사용자 조회 오류:", userError)
      
      // 더 자세한 에러 메시지
      if (userError.code === 'PGRST116') {
        return NextResponse.json(
          { error: `아이디 '${username}'을(를) 찾을 수 없습니다. 아이디를 확인해주세요.` },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: "사용자 조회 중 오류가 발생했습니다." },
        { status: 500 }
      )
    }

    if (!userData) {
      return NextResponse.json(
        { error: `아이디 '${username}'을(를) 찾을 수 없습니다.` },
        { status: 404 }
      )
    }

    if (action === "generate_temp") {
      // 임시 비밀번호 생성
      const tempPassword = generateTempPassword()
      const tempPasswordHash = hashPassword(tempPassword)
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24) // 24시간 후 만료

      console.log("📝 임시 비밀번호 생성:", tempPassword)

      // 임시 비밀번호 정보 저장
      const { error: updateError } = await queryClient
        .from("users")
        .update({
          temp_password: tempPasswordHash,
          temp_password_expires_at: expiresAt.toISOString(),
          is_temp_password: true,
          // DB 기반 인증을 위해 password_hash도 설정
          password_hash: tempPasswordHash,
        })
        .eq("id", userData.id)

      if (updateError) {
        console.error("임시 비밀번호 저장 오류:", updateError)
        return NextResponse.json(
          { error: "임시 비밀번호 생성에 실패했습니다." },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        tempPassword: tempPassword,
        username: userData.username,
        expiresAt: expiresAt.toISOString(),
        message: adminClient 
          ? "임시 비밀번호가 생성되었습니다. 24시간 내에 사용해주세요."
          : "⚠️ 임시 비밀번호: " + tempPassword + "\n\n경고: Service Role Key가 설정되지 않아 Supabase Auth에 반영되지 않았습니다.\n.env.local에 SUPABASE_SERVICE_ROLE_KEY를 추가하고 서버를 재시작하세요.",
      })
    } else if (action === "change_password") {
      // 비밀번호 변경
      const { newPassword, currentPassword } = body

      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: "새 비밀번호는 6자 이상이어야 합니다." },
          { status: 400 }
        )
      }

      // 현재 비밀번호 또는 임시 비밀번호 확인
      let isValid = false

      if (currentPassword) {
        // 임시 비밀번호 확인
        const { data: tempData } = await queryClient
          .from("users")
          .select("temp_password, temp_password_expires_at, is_temp_password, email")
          .eq("id", userData.id)
          .single()

        if (tempData?.is_temp_password && tempData.temp_password) {
          const currentHash = hashPassword(currentPassword)
          const expiresAt = new Date(tempData.temp_password_expires_at)
          
          if (currentHash === tempData.temp_password && expiresAt > new Date()) {
            isValid = true
          }
        }

        // 기존 비밀번호로도 확인
        if (!isValid) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: userData.email,
            password: currentPassword,
          })
          isValid = !signInError
        }
      }

      if (!isValid && currentPassword) {
        return NextResponse.json(
          { error: "현재 비밀번호가 올바르지 않습니다." },
          { status: 401 }
        )
      }

      // DB에 새 비밀번호 저장 (DB 기반 인증)
      const newPasswordHash = hashPassword(newPassword)
      
      console.log("📝 비밀번호 변경:", userData.username)
      
      const { error: updateError } = await queryClient
        .from("users")
        .update({
          password_hash: newPasswordHash,
          temp_password: null,
          temp_password_expires_at: null,
          is_temp_password: false,
        })
        .eq("id", userData.id)

      if (updateError) {
        console.error("비밀번호 변경 오류:", updateError)
        return NextResponse.json(
          { error: "비밀번호 변경에 실패했습니다." },
          { status: 500 }
        )
      }

      console.log("✅ 비밀번호 변경 완료:", userData.username)

      return NextResponse.json({
        success: true,
        message: "비밀번호가 성공적으로 변경되었습니다.",
      })
    } else {
      return NextResponse.json(
        { error: "잘못된 요청입니다." },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error("비밀번호 재설정 오류:", error)
    return NextResponse.json(
      { error: "비밀번호 재설정 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
