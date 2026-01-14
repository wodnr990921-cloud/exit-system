import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import FinanceClient from "./finance-client"

export default async function FinancePage() {
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

  return <FinanceClient />
}


export const dynamic = 'force-dynamic'
