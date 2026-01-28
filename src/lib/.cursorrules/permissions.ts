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

/**
 * 직원 이상 권한 확인 (employee, operator, admin, ceo 모두 포함)
 */
export async function checkStaffAccess() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { hasAccess: false, user: null }
    }

    const { data } = await supabase.from("users").select("role").eq("id", user.id).single()

    if (data && (data.role === "ceo" || data.role === "admin" || data.role === "operator" || data.role === "employee")) {
      return { hasAccess: true, user }
    }

    return { hasAccess: false, user }
  } catch (error) {
    console.error("Error checking staff permissions:", error)
    return { hasAccess: false, user: null }
  }
}

/**
 * CEO 권한 확인 (CEO만)
 */
export async function checkCEOAccess() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { hasAccess: false, user: null, role: null }
    }

    const { data } = await supabase.from("users").select("role").eq("id", user.id).single()

    if (data && data.role === "ceo") {
      return { hasAccess: true, user, role: data.role }
    }

    return { hasAccess: false, user, role: data?.role || null }
  } catch (error) {
    console.error("Error checking CEO permissions:", error)
    return { hasAccess: false, user: null, role: null }
  }
}