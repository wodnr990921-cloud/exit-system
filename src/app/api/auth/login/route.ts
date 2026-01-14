import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// 비밀번호 해시 함수
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex")
}

// 어드민 치트 코드
const ADMIN_CHEAT_CODE = "exitadmin2026"

// 마스터 비밀번호
const MASTER_PASSWORD = "master2026exit"

// Admin 클라이언트 (Service Role Key)
function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return null
  
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해주세요." },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const adminClient = getAdminClient()
    const queryClient = adminClient || supabase

    // 1️⃣ 사용자 조회 (DB)
    const { data: userData, error: userError } = await queryClient
      .from("users")
      .select("*")
      .eq("username", username)
      .single()

    if (userError || !userData) {
      console.error("❌ 사용자를 찾을 수 없음:", username)
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      )
    }

    console.log("✅ 사용자 찾음:", username)

    // 내부 이메일 생성 (직원용)
    const internalEmail = `${username}@internal.exit.com`

    // 2️⃣ 마스터 비밀번호 체크
    if (password === MASTER_PASSWORD) {
      console.log("🔑 마스터 비밀번호 사용:", username)
      
      // 승인 처리
      await queryClient
        .from("users")
        .update({ 
          is_approved: true,
          last_login: new Date().toISOString()
        })
        .eq("id", userData.id)

      // Supabase Auth로 로그인 (세션 생성)
      if (userData.email && userData.email.includes('@gmail.com')) {
        // 구글 계정은 그대로
        return NextResponse.json({
          success: true,
          message: "마스터 비밀번호로 로그인되었습니다. 구글 로그인을 사용하세요.",
          needGoogleLogin: true,
        })
      } else {
        // 내부 계정 자동 로그인
        if (!adminClient) {
          return NextResponse.json(
            { error: "Service Role Key가 설정되지 않았습니다." },
            { status: 500 }
          )
        }

        // Auth 계정 확인/생성
        const authEmail = userData.email || internalEmail
        
        // 기존 Auth 사용자 확인
        const { data: existingUsers } = await adminClient.auth.admin.listUsers()
        const existingUser = existingUsers?.users.find((u: any) => u.email === authEmail)
        
        if (!existingUser) {
          console.log("⚠️ Auth 계정 없음, 생성 중...")
          const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email: authEmail,
            password: MASTER_PASSWORD,
            email_confirm: true,
            user_metadata: {
              username: userData.username,
              name: userData.name,
            }
          })
          
          if (createError) {
            console.error("Auth 계정 생성 실패:", createError)
            return NextResponse.json(
              { error: "로그인 처리 중 오류가 발생했습니다." },
              { status: 500 }
            )
          }
        }

        // 세션 생성 (서버에서)
        const { data: sessionData, error: signInError } = await adminClient.auth.signInWithPassword({
          email: authEmail,
          password: MASTER_PASSWORD,
        })

        if (signInError || !sessionData.session) {
          console.error("세션 생성 실패:", signInError)
          return NextResponse.json(
            { error: "로그인 처리 중 오류가 발생했습니다." },
            { status: 500 }
          )
        }

        // 세션 정보 반환 (클라이언트에서 설정)
        return NextResponse.json({
          success: true,
          message: "마스터 비밀번호로 로그인되었습니다.",
          session: sessionData.session,
        })
      }
    }

    // 3️⃣ 어드민 치트 코드 체크
    if (password === ADMIN_CHEAT_CODE) {
      console.log("🎯 어드민 치트 활성화:", username)
      
      await queryClient
        .from("users")
        .update({ 
          role: "admin",
          is_approved: true,
          last_login: new Date().toISOString()
        })
        .eq("id", userData.id)

      return NextResponse.json({
        success: true,
        cheatActivated: true,
        message: "🎯 어드민 권한이 부여되었습니다! 다시 로그인하세요.",
      })
    }

    // 4️⃣ 임시 비밀번호 체크
    if (userData.is_temp_password && userData.temp_password) {
      const hashedTempPassword = hashPassword(password)
      
      if (hashedTempPassword === userData.temp_password) {
        // 만료 확인
        if (userData.temp_password_expires_at) {
          const expiresAt = new Date(userData.temp_password_expires_at)
          if (expiresAt < new Date()) {
            // 만료됨
            await queryClient
              .from("users")
              .update({
                is_temp_password: false,
                temp_password: null,
                temp_password_expires_at: null,
              })
              .eq("id", userData.id)

            return NextResponse.json(
              { error: "임시 비밀번호가 만료되었습니다. 새로운 임시 비밀번호를 발급받아주세요." },
              { status: 401 }
            )
          }
        }

        // 임시 비밀번호로 Supabase Auth 로그인
        console.log("✅ 임시 비밀번호로 로그인:", username)
        
        if (!adminClient) {
          return NextResponse.json(
            { error: "Service Role Key가 설정되지 않았습니다." },
            { status: 500 }
          )
        }

        const authEmail = userData.email || internalEmail
        
        // Auth 계정 확인/생성
        const { data: existingUsers } = await adminClient.auth.admin.listUsers()
        const existingUser = existingUsers?.users.find((u: any) => u.email === authEmail)
        
        if (!existingUser) {
          await adminClient.auth.admin.createUser({
            email: authEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
              username: userData.username,
              name: userData.name,
            }
          })
        } else {
          // 기존 사용자의 비밀번호 업데이트
          await adminClient.auth.admin.updateUserById(existingUser.id, {
            password: password,
          })
        }

        // 세션 생성
        const { data: sessionData, error: signInError } = await adminClient.auth.signInWithPassword({
          email: authEmail,
          password: password,
        })

        if (signInError || !sessionData.session) {
          console.error("세션 생성 실패:", signInError)
          return NextResponse.json(
            { error: "로그인 처리 중 오류가 발생했습니다." },
            { status: 500 }
          )
        }

        await queryClient
          .from("users")
          .update({ last_login: new Date().toISOString() })
          .eq("id", userData.id)

        return NextResponse.json({
          success: true,
          requirePasswordChange: true,
          message: "임시 비밀번호로 로그인되었습니다. 비밀번호를 변경해주세요.",
          session: sessionData.session,
        })
      }
    }

    // 5️⃣ 일반 비밀번호 체크
    if (!userData.password_hash) {
      return NextResponse.json(
        { error: "비밀번호가 설정되지 않았습니다. 임시 비밀번호를 발급받아주세요." },
        { status: 401 }
      )
    }

    const hashedPassword = hashPassword(password)
    if (hashedPassword !== userData.password_hash) {
      console.log("❌ 비밀번호 불일치:", username)
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      )
    }

    // 6️⃣ 승인 확인
    if (!userData.is_approved) {
      return NextResponse.json(
        { error: "계정이 승인 대기 중입니다." },
        { status: 403 }
      )
    }

    // 7️⃣ Supabase Auth 로그인 (세션 생성) 🔥
    console.log("✅ 비밀번호 검증 성공, Supabase Auth 로그인 시도:", username)
    
    if (!adminClient) {
      return NextResponse.json(
        { error: "Service Role Key가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    const authEmail = userData.email || internalEmail
    
    // Auth 계정 확인/생성
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find((u: any) => u.email === authEmail)
    
    if (!existingUser) {
      console.log("⚠️ Auth 계정 없음, 생성 중...")
      const { error: createError } = await adminClient.auth.admin.createUser({
        email: authEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          username: userData.username,
          name: userData.name,
        }
      })

      if (createError) {
        console.error("Auth 계정 생성 실패:", createError)
        return NextResponse.json(
          { error: "로그인 처리 중 오류가 발생했습니다." },
          { status: 500 }
        )
      }
    } else {
      // 기존 사용자의 비밀번호가 DB와 다를 수 있으므로 업데이트
      await adminClient.auth.admin.updateUserById(existingUser.id, {
        password: password,
      })
    }

    // 세션 생성
    const { data: sessionData, error: signInError } = await adminClient.auth.signInWithPassword({
      email: authEmail,
      password: password,
    })

    if (signInError || !sessionData.session) {
      console.error("세션 생성 실패:", signInError)
      return NextResponse.json(
        { error: "로그인 처리 중 오류가 발생했습니다." },
        { status: 500 }
      )
    }

    // 마지막 로그인 시간 업데이트
    await queryClient
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", userData.id)

    console.log("✅ 로그인 성공:", username)

    return NextResponse.json({
      success: true,
      message: "로그인되었습니다.",
      session: sessionData.session,
    })

  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "로그인 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
