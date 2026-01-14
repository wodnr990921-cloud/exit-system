import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import LogisticsClient from "./logistics-client"

export default async function LogisticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  return <LogisticsClient />
}


export const dynamic = 'force-dynamic'
