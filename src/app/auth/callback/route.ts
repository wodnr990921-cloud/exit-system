import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // URL을 `/dashboard`로 리다이렉트
  return NextResponse.redirect(`${origin}/dashboard`)
}
