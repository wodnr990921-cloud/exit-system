import { createClient } from "@/lib/supabase/server"

/**
 * 특정 사용자가 관리자인지 확인
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from("users").select("role").eq("id", userId).single()

    if (!data) {
      return false
    }

    return data.role === "admin"
  } catch {
    return false
  }
}

/**
 * 현재 로그인한 사용자의 관리자 권한 확인
 */
export async function checkAdminAccess(): Promise<{ isAdmin: boolean; userId: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { isAdmin: false, userId: null }
  }

  const adminStatus = await isAdmin(user.id)
  return { isAdmin: adminStatus, userId: user.id }
}
