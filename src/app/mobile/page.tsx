import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import MobileDashboard from "./dashboard/mobile-dashboard-client"

export default async function MobilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  return <MobileDashboard />
}
