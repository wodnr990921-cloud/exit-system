import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import SportsBettingClient from "./sports-betting-client"

export default async function SportsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  // 오퍼레이터 이상만 접근 가능
  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!userData || !["operator", "ceo", "admin"].includes(userData.role)) {
    redirect("/dashboard")
  }

  return <SportsBettingClient />
}


export const dynamic = 'force-dynamic'
