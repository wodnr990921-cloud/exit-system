import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ReceptionClient from "./reception-client"

export default async function ReceptionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  return <ReceptionClient />
}


export const dynamic = 'force-dynamic'
