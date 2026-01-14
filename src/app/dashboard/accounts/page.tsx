import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import AccountsClient from "./accounts-client"

export default async function AccountsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  return <AccountsClient />
}


export const dynamic = 'force-dynamic'
