import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import OcrClient from "./ocr-client"

export default async function OcrPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  return <OcrClient />
}


export const dynamic = 'force-dynamic'
