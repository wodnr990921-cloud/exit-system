import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"
import ClosingClient from "./closing-client"

export default async function ClosingPage() {
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

  return <ClosingClient />
}