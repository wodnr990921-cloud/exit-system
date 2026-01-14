import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import BlacklistClient from "./blacklist-client"

export const dynamic = 'force-dynamic'

export default async function BlacklistPage() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!userData || (userData.role !== "admin" && userData.role !== "operator")) {
    redirect("/dashboard")
  }

  return <BlacklistClient />
}
