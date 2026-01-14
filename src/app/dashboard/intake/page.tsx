import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import IntakeClient from "./intake-client"

export default async function IntakePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  return <IntakeClient />
}


export const dynamic = 'force-dynamic'
