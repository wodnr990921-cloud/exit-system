import { redirect } from "next/navigation"
import ReturnsClient from "./returns-client"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

export default async function ReturnsPage() {
  const { hasAccess } = await checkOperatorOrCEOAccess()

  if (!hasAccess) {
    redirect("/dashboard")
  }

  return <ReturnsClient />
}


export const dynamic = 'force-dynamic'
