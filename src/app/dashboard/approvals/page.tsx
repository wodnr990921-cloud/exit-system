import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"
import ApprovalsClient from "./approvals-client"

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const { hasAccess } = await checkOperatorOrCEOAccess()

  if (!hasAccess) {
    redirect("/dashboard")
  }

  return <ApprovalsClient />
}
