import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { checkAdminAccess } from "@/lib/.cursorrules/admin"
import EmployeesClient from "./employees-client"

export default async function EmployeesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const { isAdmin } = await checkAdminAccess()

  if (!isAdmin) {
    redirect("/dashboard")
  }

  return <EmployeesClient />
}


export const dynamic = 'force-dynamic'
