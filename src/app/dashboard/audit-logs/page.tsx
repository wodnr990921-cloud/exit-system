import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import AuditLogsClient from "./audit-logs-client"

export const dynamic = "force-dynamic"

export default async function AuditLogsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/")
  }

  // Check user role
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  // Only admin and CEO can access audit logs
  if (!userData || !["admin", "ceo"].includes(userData.role)) {
    redirect("/dashboard")
  }

  return <AuditLogsClient userRole={userData.role} userId={user.id} />
}
