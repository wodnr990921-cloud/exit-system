import { createClient } from "@/lib/supabase/server"

/**
 * 오퍼레이터 또는 CEO 권한 확인
 */
export async function checkOperatorOrCEOAccess() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { hasAccess: false, user: null }
    }

    const { data } = await supabase.from("users").select("role").eq("id", user.id).single()

    if (data && (data.role === "ceo" || data.role === "operator" || data.role === "admin")) {
      return { hasAccess: true, user }
    }

    return { hasAccess: false, user }
  } catch (error) {
    console.error("Error checking permissions:", error)
    return { hasAccess: false, user: null }
  }
}

/**
 * 읽기 권한 확인 (모든 로그인 사용자)
 */
export async function checkReadAccess() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    return { hasAccess: !!user, user }
  } catch (error) {
    console.error("Error checking read access:", error)
    return { hasAccess: false, user: null }
  }
}

/**
 * 관리 권한 확인 (오퍼레이터 이상)
 */
export async function checkManagementAccess() {
  return checkOperatorOrCEOAccess()
}
