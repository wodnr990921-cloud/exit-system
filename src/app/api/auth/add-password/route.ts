import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Admin 클라이언트 생성
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceRoleKey) {
    return null
  }
  
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { newPassword } = body

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 6자 이상이어야 합니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 현재 로그인한 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    if (!adminClient) {
      return NextResponse.json(
        { error: "Service Role Key가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    // OAuth 계정에 비밀번호 추가
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )

    if (updateError) {
      console.error("비밀번호 추가 오류:", updateError)
      return NextResponse.json(
        { error: "비밀번호 추가에 실패했습니다." },
        { status: 500 }
      )
    }

    // users 테이블에 정보 업데이트
    const queryClient = adminClient || supabase
    await queryClient
      .from("users")
      .update({
        is_temp_password: false,
        temp_password: null,
        temp_password_expires_at: null,
      })
      .eq("id", user.id)

    return NextResponse.json({
      success: true,
      message: "비밀번호가 설정되었습니다. 이제 username/password로도 로그인할 수 있습니다.",
    })
  } catch (error: any) {
    console.error("비밀번호 추가 오류:", error)
    return NextResponse.json(
      { error: "비밀번호 추가 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
